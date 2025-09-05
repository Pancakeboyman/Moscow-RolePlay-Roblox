const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_ROLES } = require('../apikeys');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('заблокированные_машины')
        .setDescription('Показать список заблокированных машин'),
    async execute(interaction, { db }) {
        if (!interaction.member.roles.cache.some(role => ADMIN_ROLES.includes(role.id))) {
            return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setDescription('❌ Нет прав для этой команды!').setColor(0xF31F1F)] });
        }
        db.all("SELECT car_name, created_at FROM locked_cars ORDER BY car_name", (err, cars) => {
            if (!cars || cars.length === 0) {
                return interaction.reply({ embeds: [new EmbedBuilder().setTitle('ℹ️ Нет заблокированных машин').setDescription('В данный момент нет заблокированных автомобилей.').setColor(0xF31F1F)] });
            }
            const list = cars.map((c, i) => `\`${i + 1}.\` **${c.car_name}**${c.created_at ? ` _(с ${c.created_at})_` : ""}`).join('\n');
            interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔒 Заблокированные автомобили').setDescription(list).setColor(0xF31F1F)] });
        });
    }
};