import beverages from '../../../data/beverages.yaml';
import dairy from '../../../data/dairy.yaml';
import fatsOils from '../../../data/fats-oils.yaml';
import fruitsVegetablesNuts from '../../../data/fruits-vegetables-nuts.yaml';
import grainsCereals from '../../../data/grains-cereals.yaml';
import meatsEggsFish from '../../../data/meats-eggs-fish.yaml';
import pantryMisc from '../../../data/pantry-misc.yaml';
import sugarsSweets from '../../../data/sugars-sweets.yaml';
import userDefined from '../../../data/user-defined.yaml';

export const DEFAULT_SOURCES = [
    { name: 'beverages', data: beverages },
    { name: 'dairy', data: dairy },
    { name: 'fats-oils', data: fatsOils },
    { name: 'fruits-vegetables-nuts', data: fruitsVegetablesNuts },
    { name: 'grains-cereals', data: grainsCereals },
    { name: 'meats-eggs-fish', data: meatsEggsFish },
    { name: 'pantry-misc', data: pantryMisc },
    { name: 'sugars-sweets', data: sugarsSweets },
    { name: 'user-defined', data: userDefined },
];
