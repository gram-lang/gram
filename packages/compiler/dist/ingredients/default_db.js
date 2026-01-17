"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SOURCES = void 0;
const beverages_yaml_1 = __importDefault(require("../../../../data/beverages.yaml"));
const dairy_yaml_1 = __importDefault(require("../../../../data/dairy.yaml"));
const fats_oils_yaml_1 = __importDefault(require("../../../../data/fats-oils.yaml"));
const fruits_vegetables_nuts_yaml_1 = __importDefault(require("../../../../data/fruits-vegetables-nuts.yaml"));
const grains_cereals_yaml_1 = __importDefault(require("../../../../data/grains-cereals.yaml"));
const meats_eggs_fish_yaml_1 = __importDefault(require("../../../../data/meats-eggs-fish.yaml"));
const pantry_misc_yaml_1 = __importDefault(require("../../../../data/pantry-misc.yaml"));
const sugars_sweets_yaml_1 = __importDefault(require("../../../../data/sugars-sweets.yaml"));
const user_defined_yaml_1 = __importDefault(require("../../../../data/user-defined.yaml"));
exports.DEFAULT_SOURCES = [
    { name: 'beverages', data: beverages_yaml_1.default },
    { name: 'dairy', data: dairy_yaml_1.default },
    { name: 'fats-oils', data: fats_oils_yaml_1.default },
    { name: 'fruits-vegetables-nuts', data: fruits_vegetables_nuts_yaml_1.default },
    { name: 'grains-cereals', data: grains_cereals_yaml_1.default },
    { name: 'meats-eggs-fish', data: meats_eggs_fish_yaml_1.default },
    { name: 'pantry-misc', data: pantry_misc_yaml_1.default },
    { name: 'sugars-sweets', data: sugars_sweets_yaml_1.default },
    { name: 'user-defined', data: user_defined_yaml_1.default },
];
