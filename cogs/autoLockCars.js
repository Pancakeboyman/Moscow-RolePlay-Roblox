// Основной список машин для всех статусов (Кремль = статус 3)
const CIVILIAN_CARS = [
    "Surrey 650S 2016",
    "Chevlon Corbeta RZR 2014",
    "Navara Horizon 2013",
    "Strugatti Ettore 2020",
    "Chevlon Amigo LZR 2011",
    "Chevlon Amigo LZR 2016",
    "Chevlon Amigo S 2011",
    "Chevlon Amigo S 2016",
    "Falcon Heritage 2021",
    "Chevlon Corbeta 8 2023",
    "Bullhorn Determinator SFP Fury 2022",
    "Bullhorn Determinator SFP Blackjack Widebody 2022",
    "Averon R8 2017",
    "Takeo Experience 2021",
    "Ferdinand Jalapeno Turbo 2022",
    "Overland Apache SFP 2020",
    "BKM Risen Roadster 2020",
    "Chevlon Corbeta 1M Edition 2014",
    "Chevlon Corbeta X08 2014",
    "Falcon Heritage Track 2022",
    "Kovac Heladera 2023",
    "Celestial Type-6 2023",
    "Averon Bremen VS Garde 2023",
    "Stuttgart Landschaft 2022"
];

// 6 самых простых/умеренных для статуса 1 ("Арбат")
const STATUS1_CARS = [
    "Chevlon Amigo S 2011",
    "Chevlon Amigo S 2016",
    "Overland Apache SFP 2020",
    "Averon Bremen VS Garde 2023",
    "Stuttgart Landschaft 2022",
    "Ferdinand Jalapeno Turbo 2022"
];

// 6 следующих (для статуса 2, итого 12)
const STATUS2_CARS = [
    ...STATUS1_CARS,
    "Chevlon Corbeta RZR 2014",
    "Chevlon Amigo LZR 2011",
    "Chevlon Amigo LZR 2016",
    "Stuttgart Landschaft 2022",
    "Chevlon Corbeta 1M Edition 2014",
    "Celestial Type-6 2023",
    "Bullhorn Determinator SFP Fury 2022"
];

// Для статуса 3 ("Кремль") — всё!
const STATUS3_CARS = CIVILIAN_CARS;

// Для бустеров — 6 машин повыше классом, но не все топовые
const BOOSTER_CARS = [
    "Bullhorn Determinator SFP Fury 2022",
    "Bullhorn Determinator SFP Blackjack Widebody 2022",
    "Celestial Type-6 2023",
    "Averon Bremen VS Garde 2023",
    "Chevlon Corbeta 1M Edition 2014",
    "Chevlon Corbeta X08 2014",
    "Stuttgart Landschaft 2022"
];

// VIP автомобили
const VIP_CARS = [
    "Stuttgart Landschaft 2022",
    "Bullhorn Determinator SFP Fury 2022",
    "Chevlon Amigo LZR 2011",
    "Chevlon Amigo LZR 2016",
    "Celestial Type-6 2023",
    "Averon Bremen VS Garde 2023"
];

// Discord role IDs
const BOOSTER_ROLE_ID = "1364498859933438073";
const VIP_ROLE_ID = "1344414672001957988";
const STATUS1_ROLE_ID = "1375524323724496946";
const STATUS2_ROLE_ID = "1375524827770912788";
const STATUS3_ROLE_ID = "1375525084219052144";

const STATUS_LABELS = {
    [STATUS1_ROLE_ID]: "Арбат",
    [STATUS2_ROLE_ID]: "Тверская",
    [STATUS3_ROLE_ID]: "Кремль",
    [BOOSTER_ROLE_ID]: "Бустер сервера",
    [VIP_ROLE_ID]: "VIP сервера"
};

// Автоматическая блокировка всех машин по списку
function autoLockAllCars(db, logger) {
    db.serialize(() => {
        for (const car of CIVILIAN_CARS) {
            db.run(
                "INSERT OR IGNORE INTO locked_cars (car_name, created_at) VALUES (?, datetime('now'))",
                [car],
                err => {
                    if (err && logger) logger.error(`Ошибка авто-блокировки машины ${car}: ${err}`);
                }
            );
        }
        for (const car of VIP_CARS) {
            db.run(
                "INSERT OR IGNORE INTO locked_vip_cars (car_name, created_at) VALUES (?, datetime('now'))",
                [car],
                err => {
                    if (err && logger) logger.error(`Ошибка авто-блокировки VIP машины ${car}: ${err}`);
                }
            );
        }
        if (logger) logger.info(`🔒 Все машины заблокированы автоматически`);
    });
}

// Синхронизация locked_cars и locked_vip_cars с актуальными списками
function syncLockedCars(db, vipDb, logger) {
    db.serialize(() => {
        db.run(
            `DELETE FROM locked_cars WHERE car_name NOT IN (${CIVILIAN_CARS.map(() => '?').join(',')})`,
            CIVILIAN_CARS,
            err => { if (err && logger) logger.error("Ошибка при удалении устаревших машин из locked_cars: " + err); }
        );
        for (const car of CIVILIAN_CARS) {
            db.run(
                "INSERT OR IGNORE INTO locked_cars (car_name, created_at) VALUES (?, datetime('now'))",
                [car],
                err => { if (err && logger) logger.error(`Ошибка при добавлении машины ${car} в locked_cars: ${err}`); }
            );
        }
    });
    vipDb.serialize(() => {
        vipDb.run(
            `DELETE FROM locked_vip_cars WHERE car_name NOT IN (${VIP_CARS.map(() => '?').join(',')})`,
            VIP_CARS,
            err => { if (err && logger) logger.error("Ошибка при удалении устаревших машин из locked_vip_cars: " + err); }
        );
        for (const car of VIP_CARS) {
            vipDb.run(
                "INSERT OR IGNORE INTO locked_vip_cars (car_name, created_at) VALUES (?, datetime('now'))",
                [car],
                err => { if (err && logger) logger.error(`Ошибка при добавлении машины ${car} в locked_vip_cars: ${err}`); }
            );
        }
    });
    if (logger) logger.info("✅ Таблицы locked_cars и locked_vip_cars синхронизированы");
}

module.exports = {
    autoLockAllCars,
    syncLockedCars,
    CIVILIAN_CARS,
    STATUS1_CARS,
    STATUS2_CARS,
    STATUS3_CARS,
    VIP_CARS,
    BOOSTER_CARS,
    BOOSTER_ROLE_ID,
    VIP_ROLE_ID,
    STATUS1_ROLE_ID,
    STATUS2_ROLE_ID,
    STATUS3_ROLE_ID,
    STATUS_LABELS
};