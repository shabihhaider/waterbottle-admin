"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPKR = void 0;
const formatPKR = (n) => new Intl.NumberFormat('ur-PK', { style: 'currency', currency: 'PKR' }).format(Number(n));
exports.formatPKR = formatPKR;
//# sourceMappingURL=currency.js.map