require('dotenv').config();
const config = require('./config.json');

process.on('unhandledRejection', (err) => {
    console.error('Erreur non gérée (le bot continue de tourner) :', err);
});

const Database = require('easy-json-database');
const db = new Database('./db.json');
if (!db.has('subscriptions')) db.set('subscriptions', []);

const Discord = require('discord.js');
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS]
});

const synchronizeSlashCommands = require('discord-sync-commands');
synchronizeSlashCommands(client, [
    {
        name: 'abonner',
        description: 'Abonnez-vous à une URL de recherche',
        options: [
            {
                name: 'url',
                description: 'L\'URL de la recherche Vinted',
                type: 3,
                required: true
            },
            {
                name: 'channel',
                description: 'Le salon dans lequel vous souhaitez envoyer les notifications',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'filtre',
        description: 'Crée un salon dédié qui ne reçoit que les articles d\'une marque sous un prix donné',
        options: [
            {
                name: 'marque',
                description: 'Marque à surveiller (ex: Nike, Adidas, Ralph Lauren)',
                type: 3,
                required: true
            },
            {
                name: 'prix_max',
                description: 'Prix maximum en euros',
                type: 10,
                required: true
            },
            {
                name: 'taille',
                description: 'Taille exacte à filtrer (ex: M, L, 42)',
                type: 3,
                required: false
            },
            {
                name: 'mots_cles',
                description: 'Mots-clés supplémentaires (ex: sweat, jogging)',
                type: 3,
                required: false
            }
        ]
    },
    {
        name: 'désabonner',
        description: 'Désabonnez-vous d\'une URL de recherche',
        options: [
            {
                name: 'id',
                description: 'L\'identifiant de l\'abonnement (/abonnements)',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'abonnements',
        description: 'Accèdez à la liste de tous vos abonnements',
        options: []
    }
], {
    debug: false,
    guildId: config.guildID
}).then((stats) => {
    console.log(`🔁 Commandes mises à jour ! ${stats.newCommandCount} commandes créées, ${stats.currentCommandCount} commandes existantes\n`)
});

const vinted = require('vinted-api');

let lastFetchFinished = true;

const parsePrice = (str) => {
    if (!str) return null;
    const value = parseFloat(String(str).replace(/[^\d,.-]/g, '').replace(',', '.'));
    return Number.isNaN(value) ? null : value;
};

const buildVintedUrl = ({ marque, motsCles, prixMax }) => {
    const searchText = [marque, motsCles].filter(Boolean).join(' ').trim();
    const params = new URLSearchParams();
    params.set('search_text', searchText);
    params.set('order', 'newest_first');
    if (prixMax) params.set('price_to', String(prixMax));
    return `https://www.vinted.fr/catalog?${params.toString()}`;
};

const slugify = (str) => str
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 90);

const buildChannelName = ({ marque, taille, prixMax }) => {
    const parts = [marque, taille, `${prixMax}e`].filter(Boolean);
    return slugify(parts.join('-')) || 'filtre-vinted';
};

const createSubscription = ({ url, channelID, marque, taille, prixMax }) => {
    const sub = {
        id: Math.random().toString(36).substring(7),
        url,
        channelID,
        marque: marque || null,
        taille: taille || null,
        prixMax: prixMax || null
    };
    db.push('subscriptions', sub);
    db.set(`last_item_ts_${sub.id}`, null);
    return sub;
};

const syncSubscription = (sub) => {
    return new Promise((resolve) => {
        vinted.search(sub.url, false, false, {
            per_page: '20'
        }).then((res) => {
            if (!res.items) {
                console.log('Search done bug got wrong response. Promise resolved.', res);
                resolve();
                return;
            }
            const isFirstSync = db.get('is_first_sync');
            const lastItemTimestamp = db.get(`last_item_ts_${sub.id}`);
            const items = res.items
                .sort((a, b) => new Date(b.created_at_ts).getTime() - new Date(a.created_at_ts).getTime())
                .filter((item) => !lastItemTimestamp || new Date(item.created_at_ts) > lastItemTimestamp);

            if (!items.length) return void resolve();

            const newLastItemTimestamp = new Date(items[0].created_at_ts).getTime();
            if (!lastItemTimestamp || newLastItemTimestamp > lastItemTimestamp) {
                db.set(`last_item_ts_${sub.id}`, newLastItemTimestamp);
            }

            let itemsToSend = ((lastItemTimestamp && !isFirstSync) ? items.reverse() : [items[0]]);

            if (sub.prixMax || sub.taille) {
                itemsToSend = itemsToSend.filter((item) => {
                    if (sub.prixMax) {
                        const price = parsePrice(item.price);
                        if (price === null || price > sub.prixMax) return false;
                    }
                    if (sub.taille) {
                        const size = (item.size || '').trim().toLowerCase();
                        if (size !== sub.taille.trim().toLowerCase()) return false;
                    }
                    return true;
                });
            }

            for (let item of itemsToSend) {
                const embed = new Discord.MessageEmbed()
                    .setTitle(item.title)
                    .setURL(`https://www.vinted.fr${item.path}`)
                    .setImage(item.photos[0]?.url)
                    .setColor('#008000')
                    .setTimestamp(item.createdTimestamp)
                    .setFooter(`Article lié à la recherche : ${sub.id}`)
                    .addField('Taille', item.size || 'vide', true)
                    .addField('Prix', item.price || 'vide', true)
                    .addField('Condition', item.status || 'vide', true);
                client.channels.cache.get(sub.channelID)?.send({ embeds: [embed], components: [
                    new Discord.MessageActionRow()
                        .addComponents([
                            new Discord.MessageButton()
                                .setLabel('Détails')
                                .setURL(item.url)
                                .setEmoji('🔎')
                                .setStyle('LINK'),
                            new Discord.MessageButton()
                                .setLabel('Acheter')
                                .setURL(`https://www.vinted.fr/transaction/buy/new?source_screen=item&transaction%5Bitem_id%5D=${item.id}`)
                                .setEmoji('💸')
                                .setStyle('LINK')
                        ])
                ] });
            }

            if (itemsToSend.length > 0) {
                console.log(`👕 ${itemsToSend.length} ${itemsToSend.length > 1 ? 'nouveaux articles trouvés' : 'nouvel article trouvé'} pour la recherche ${sub.id} !\n`)
            }

            resolve();
        }).catch((e) => {
            console.error('Search returned an error. Promise resolved.', e);
            resolve();
        });
    });
};

const sync = () => {

    if (!lastFetchFinished) return;
    lastFetchFinished = false;

    console.log(`🤖 Synchronisation à Vinted...\n`);

    const subscriptions = db.get('subscriptions');
    const promises = subscriptions.map((sub) => syncSubscription(sub));
    Promise.all(promises).then(() => {
        db.set('is_first_sync', false);
        lastFetchFinished = true;
    });

};

client.on('ready', () => {
    console.log(`🔗 Connecté sur le compte de ${client.user.tag} !\n`);

    const entries = db.all().filter((e) => e.key !== 'subscriptions' && !e.key.startsWith('last_item_ts'));
    entries.forEach((e) => {
        db.delete(e.key);
    });
    db.set('is_first_sync', true);

    const messages = [
        `🕊️ Ce projet libre et gratuit demande du temps. Si vous en avez les moyens, n'hésitez pas à soutenir le développement avec un don ! https://paypal.me/andr0z\n`,
        `🤟 Le saviez-vous ? Nous proposons notre propre version du bot en ligne 24/24 7/7 sans que vous n'ayez besoin de vous soucier de quoi que ce soit ! https://distrobot.fr\n`
    ];
    let idx = 0;
    const donate = () => console.log(messages[ idx % 2 ]);
    setTimeout(() => {
        donate();
    }, 3000);
    setInterval(() => {
        idx++;
        donate();
    }, 20000);

    sync();
    setInterval(sync, 5000);

    const { version } = require('./package.json');
    client.user.setActivity(`Vinted BOT | v${version}`);
});

client.on('interactionCreate', (interaction) => {

    if (!interaction.isCommand()) return;
    if (!config.adminIDs.includes(interaction.user.id)) return void interaction.reply(`:x: Vous ne disposez pas des droits pour effectuer cette action !`);

    switch (interaction.commandName) {
        case 'abonner': {
            const sub = createSubscription({
                url: interaction.options.getString('url'),
                channelID: interaction.options.getChannel('channel').id
            });
            interaction.reply(`:white_check_mark: Votre abonnement a été créé avec succès !\n**URL**: <${sub.url}>\n**Salon**: <#${sub.channelID}>`);
            break;
        }
        case 'filtre': {
            const marque = interaction.options.getString('marque');
            const prixMax = interaction.options.getNumber('prix_max');
            const taille = interaction.options.getString('taille');
            const motsCles = interaction.options.getString('mots_cles');

            if (!interaction.guild) return void interaction.reply(':x: Cette commande doit être utilisée dans un serveur.');

            interaction.deferReply().then(() => {
                return interaction.guild.channels.create(buildChannelName({ marque, taille, prixMax }), {
                    type: 'GUILD_TEXT',
                    reason: `Filtre Vinted créé par ${interaction.user.tag}`
                });
            }).then((channel) => {
                const url = buildVintedUrl({ marque, motsCles, prixMax });
                const sub = createSubscription({ url, channelID: channel.id, marque, taille, prixMax });
                interaction.editReply(`:white_check_mark: Filtre créé ! Les articles **${marque}**${taille ? ` (taille ${taille})` : ''} à moins de **${prixMax}€** seront envoyés dans <#${channel.id}>.\n(ID de l'abonnement : ${sub.id})`);
            }).catch((e) => {
                console.error('Impossible de créer le salon pour le filtre.', e);
                if (interaction.deferred || interaction.replied) {
                    interaction.editReply(':x: Impossible de créer le salon. Vérifiez que le bot a bien la permission "Gérer les salons" sur ce serveur.').catch(() => {});
                }
            });
            break;
        }
        case 'désabonner': {
            const subID = interaction.options.getString('id');
            const subscriptions = db.get('subscriptions')
            const subscription = subscriptions.find((sub) => sub.id === subID);
            if (!subscription) {
                return void interaction.reply(':x: Aucun abonnement trouvé pour votre recherche...');
            }
            const newSubscriptions = subscriptions.filter((sub) => sub.id !== subID);
            db.set('subscriptions', newSubscriptions);
            interaction.reply(`:white_check_mark: Abonnement supprimé avec succès !\n**URL**: <${subscription.url}>\n**Salon**: <#${subscription.channelID}>`);
            break;
        }
        case 'abonnements': {
            const subscriptions = db.get('subscriptions');
            const chunks = [];
    
            subscriptions.forEach((sub) => {
                const details = [];
                if (sub.marque) details.push(`**Marque**: ${sub.marque}`);
                if (sub.taille) details.push(`**Taille**: ${sub.taille}`);
                if (sub.prixMax) details.push(`**Prix max**: ${sub.prixMax}€`);
                const content = `**ID**: ${sub.id}\n**URL**: ${sub.url}\n**Salon**: <#${sub.channelID}>${details.length ? `\n${details.join('\n')}` : ''}\n`;
                const lastChunk = chunks.shift() || [];
                if ((lastChunk.join('\n').length + content.length) > 1024) {
                    if (lastChunk) chunks.push(lastChunk);
                    chunks.push([ content ]);
                } else {
                    lastChunk.push(content);
                    chunks.push(lastChunk);
                }
            });
    
            interaction.reply(`:white_check_mark: **${subscriptions.length}** abonnements sont actifs !`);
    
            chunks.forEach((chunk) => {
                const embed = new Discord.MessageEmbed()
                .setColor('RED')
                .setAuthor(`Utilisez la commande /désabonner pour supprimer un abonnement !`)
                .setDescription(chunk.join('\n'));
            
                interaction.channel.send({ embeds: [embed] });
            });
        }
    }
});

client.login(process.env.TOKEN);
