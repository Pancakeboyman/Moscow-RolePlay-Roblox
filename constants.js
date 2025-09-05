// constants.js
const STATUS1_ROLE_ID = "1375524323724496946"; // Арбат
const STATUS2_ROLE_ID = "1375524827770912788"; // Тверская
const STATUS3_ROLE_ID = "1375525084219052144"; // Кремль
const BOOSTER_ROLE_ID = "1364498859933438073";
const VIP_ROLE_ID = "1344414672001957988";

const STATUS_LABELS = {
    1: "Арбат",
    2: "Тверская",
    3: "Кремль",
    [STATUS1_ROLE_ID]: "Арбат",
    [STATUS2_ROLE_ID]: "Тверская",
    [STATUS3_ROLE_ID]: "Кремль",
    [BOOSTER_ROLE_ID]: "Бустер сервера"
};

const STATUS_ROLES = {
    1: STATUS1_ROLE_ID,
    2: STATUS2_ROLE_ID,
    3: STATUS3_ROLE_ID
};

module.exports = {
    STATUS1_ROLE_ID,
    STATUS2_ROLE_ID,
    STATUS3_ROLE_ID,
    BOOSTER_ROLE_ID,
    VIP_ROLE_ID,
    STATUS_LABELS,
    STATUS_ROLES
};