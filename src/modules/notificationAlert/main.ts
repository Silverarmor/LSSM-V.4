import settingsItem from './components/settings-item.vue';
import settingTitles from './components/settings-titles.vue';
import { NotificationSetting } from 'typings/modules/NotificationAlert';
import { AllianceChatMessage, RadioMessage } from 'typings/Ingame';
import fmsImage from './assets/fmsImage';

(async (LSSM: Vue) => {
    await LSSM.$store.dispatch('settings/register', {
        moduleId: MODULE_ID,
        settings: {
            alerts: {
                type: 'appendable-list',
                default: [],
                listItemComponent: settingsItem,
                titleComponent: settingTitles,
                defaultItem: {
                    events: [],
                    alertStyle: 'success',
                    duration: 8000,
                    ingame: true,
                    desktop: true,
                    position: 'bottom right',
                },
            },
        },
    });

    const $m = (key: string, args?: { [key: string]: unknown }) =>
        LSSM.$t(`modules.${MODULE_ID}.${key}`, args);
    const $mc = (
        key: string,
        amount?: number,
        args?: { [key: string]: unknown }
    ) => LSSM.$tc(`modules.${MODULE_ID}.${key}`, amount, args);

    const alerts = (await LSSM.$store.dispatch('settings/getSetting', {
        moduleId: MODULE_ID,
        settingId: 'alerts',
    })) as NotificationSetting[];

    const events = {} as {
        [event: string]: {
            alertStyle: NotificationSetting['alertStyle'];
            duration: NotificationSetting['duration'];
            ingame: NotificationSetting['ingame'];
            desktop: NotificationSetting['desktop'];
            position: NotificationSetting['position'];
        }[];
    };
    alerts.forEach(alert =>
        alert.events.forEach(event => {
            if (!events.hasOwnProperty(event)) events[event] = [];
            events[event].push({
                alertStyle: alert.alertStyle,
                duration: alert.duration,
                ingame: alert.ingame,
                desktop: alert.desktop,
                position: alert.position,
            });
        })
    );

    // Chat messages
    const chatEvents = [
        'allianceChat',
        'allianceChatMention',
        'allianceChatWhisper',
    ].filter(ce => events.hasOwnProperty(ce));
    if (chatEvents.length)
        await LSSM.$store.dispatch('hook', {
            event: 'allianceChat',
            callback({
                message,
                whisper,
                user_id,
                username,
                mission_id,
                mission_caption,
            }: AllianceChatMessage) {
                if (user_id === window.user_id) return;
                const ucmsg = message.toUpperCase();
                const ucun = window.username.toUpperCase();
                const isWhispered = whisper === window.user_id;
                const isMentioned = !!(
                    !whisper &&
                    (ucmsg.match(
                        new RegExp(
                            `@(${LSSM.$utils.escapeRegex(ucun)}|all[ :])`
                        )
                    ) ||
                        (ucmsg.match(/@admin/) &&
                            (window.alliance_admin || window.alliance_coadmin)))
                );
                const title = `<a href="/profile/${user_id}" class="lightbox-open">${username}</a>${
                    mission_id
                        ? `: [<a href="/missions/${mission_id}" class="lightbox-open">${mission_caption}</a>]`
                        : ``
                }`;
                if (isWhispered)
                    events['allianceChatWhisper'].forEach(alert =>
                        LSSM.$store.dispatch('notifications/sendNotification', {
                            group: alert.position,
                            type: alert.alertStyle,
                            title: `🔇 ${title}`,
                            text: message,
                            icon: '', // TODO: Chat Icon
                            duration: alert.duration,
                            ingame: alert.ingame,
                            desktop: alert.desktop,
                            clickHandler() {
                                if (mission_id)
                                    window.lightboxOpen(
                                        `/missions/${mission_id}`
                                    );
                            },
                        })
                    );
                else if (isMentioned)
                    events['allianceChatMention'].forEach(alert =>
                        LSSM.$store.dispatch('notifications/sendNotification', {
                            group: alert.position,
                            type: alert.alertStyle,
                            title: `ℹ️ ${title}`,
                            text: message,
                            icon: '', // TODO: Chat Icon
                            duration: alert.duration,
                            ingame: alert.ingame,
                            desktop: alert.desktop,
                            clickHandler() {
                                if (mission_id)
                                    window.lightboxOpen(
                                        `/missions/${mission_id}`
                                    );
                            },
                        })
                    );
                else
                    events['allianceChat'].forEach(alert =>
                        LSSM.$store.dispatch('notifications/sendNotification', {
                            group: alert.position,
                            type: alert.alertStyle,
                            title,
                            text: message,
                            icon: '', // TODO: Chat Icon
                            duration: alert.duration,
                            ingame: alert.ingame,
                            desktop: alert.desktop,
                            clickHandler() {
                                if (mission_id)
                                    window.lightboxOpen(
                                        `/missions/${mission_id}`
                                    );
                            },
                        })
                    );
            },
        });

    // Radio messages
    const fmsEvents = [
        'vehicle_fms',
        'vehicle_fms_0',
        'vehicle_fms_1',
        'vehicle_fms_2',
        'vehicle_fms_3',
        'vehicle_fms_4',
        'vehicle_fms_5',
        'vehicle_fms_6',
        'vehicle_fms_7',
        'vehicle_fms_8',
        'vehicle_fms_9',
        'sicherheitswache_success',
        'sicherheitswache_error',
    ].filter(ce => events.hasOwnProperty(ce));
    if (fmsEvents.length)
        await LSSM.$store.dispatch('hook', {
            event: 'radioMessage',
            callback(message: RadioMessage) {
                if (message.user_id !== window.user_id) return;

                // sicherheitswache
                const siwa_success = fmsEvents.includes(
                    'sicherheitswache_success'
                );
                const siwa_error = fmsEvents.includes('sicherheitswache_error');
                if (
                    (siwa_success || siwa_error) &&
                    message.type === 'sicherheitswache'
                ) {
                    const mode = message.success
                        ? 'sicherheitswache_success'
                        : 'sicherheitswache_error';
                    if (
                        (siwa_success && message.success) ||
                        (siwa_error && !message.success)
                    )
                        events[mode].forEach(alert =>
                            LSSM.$store.dispatch(
                                'notifications/sendNotification',
                                {
                                    group: alert.position,
                                    type: alert.alertStyle,
                                    title: $m(`events.${mode}`).toString(),
                                    text: window.I18n.t(`javascript.${mode}`, {
                                        caption: message.caption,
                                        credits: message.credits,
                                    }),
                                    icon: '', // TODO: SiWa Icon
                                    duration: alert.duration,
                                    ingame: alert.ingame,
                                    desktop: alert.desktop,
                                }
                            )
                        );
                }

                const fmsAll = fmsEvents.includes('vehicle_fms');
                const fmsStatuses = fmsEvents.filter(e =>
                    e.match(/vehicle_fms_\d+/)
                );
                if (
                    (fmsAll || fmsStatuses.length) &&
                    message.type === 'vehicle_fms'
                ) {
                    const icon = fmsImage(message.fms_real, message.fms);
                    const mode = `vehicle_fms_${message.fms}`;
                    const title = $m(`messages.radioMessage.title`, {
                        vehicle: message.caption,
                        status: message.fms,
                    }).toString();
                    const clickHandler = () =>
                        window.lightboxOpen(`/vehicles/${message.id}`);
                    if (fmsStatuses.includes(mode))
                        events[mode].forEach(alert =>
                            LSSM.$store.dispatch(
                                'notifications/sendNotification',
                                {
                                    group: alert.position,
                                    type: alert.alertStyle,
                                    title,
                                    text:
                                        message.additionalText ||
                                        message.fms_text,
                                    icon,
                                    duration: alert.duration,
                                    ingame: alert.ingame,
                                    desktop: alert.desktop,
                                    clickHandler,
                                }
                            )
                        );
                    else if (fmsAll)
                        events['vehicle_fms'].forEach(alert =>
                            LSSM.$store.dispatch(
                                'notifications/sendNotification',
                                {
                                    group: alert.position,
                                    type: alert.alertStyle,
                                    title,
                                    text:
                                        message.additionalText ||
                                        message.fms_text,
                                    icon,
                                    duration: alert.duration,
                                    ingame: alert.ingame,
                                    desktop: alert.desktop,
                                    clickHandler,
                                }
                            )
                        );
                }
            },
        });

    // Private direct messages
    if (events['dm'])
        await LSSM.$store.dispatch('hook', {
            event: 'messageUnreadUpdate',
            post: false,
            callback(amount: string) {
                const newAmount = parseInt(amount);
                const prevAmount = parseInt(
                    document
                        .getElementById('message_top')
                        ?.textContent?.trim() || '-1'
                );
                if (newAmount <= prevAmount) return;
                events['dm'].forEach(alert =>
                    LSSM.$store.dispatch('notifications/sendNotification', {
                        group: alert.position,
                        type: alert.alertStyle,
                        title: $mc('messages.dm.title', newAmount - prevAmount),
                        text: $mc('messages.dm.body', newAmount),
                        icon: '/images/message_ffffff.svg',
                        duration: alert.duration,
                        ingame: alert.ingame,
                        desktop: alert.desktop,
                        clickHandler() {
                            window.lightboxOpen('/messages');
                        },
                    })
                );
            },
        });

    // Ingame news (Blog, Facebook)
    if (events['ingame_news'])
        await LSSM.$store.dispatch('hook', {
            event: 'newsNew',
            post: false,
            callback(hasNew: boolean) {
                if (!hasNew) return;
                events['ingame_news'].forEach(alert =>
                    LSSM.$store.dispatch('notifications/sendNotification', {
                        group: alert.position,
                        type: alert.alertStyle,
                        title: $m('messages.ingame_news.title'),
                        text: $m('messages.ingame_news.body'),
                        icon: '/images/google_news_ffffff.svg',
                        duration: alert.duration,
                        ingame: alert.ingame,
                        desktop: alert.desktop,
                    })
                );
            },
        });
})(window[PREFIX] as Vue);