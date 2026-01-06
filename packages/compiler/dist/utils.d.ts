import { Usage, QuantityValueAST } from 'gram-parser';
export declare const slugify: (text: string | number) => string;
export declare const minifyQuantity: (q: any) => number | QuantityValueAST | undefined;
export declare const createCleanUsage: (item: any, id: string, overrides?: Record<string, number>) => Usage;
export declare const cleanObject: (obj: any) => any;
