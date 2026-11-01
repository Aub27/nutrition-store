import { FormControl } from '@angular/forms';
import { moroccanPhone } from './checkout.page';

describe('moroccanPhone validator', () => {
  const ok = (v: string) => moroccanPhone(new FormControl(v)) === null;

  it('accepts common Moroccan formats', () => {
    for (const v of ['0612345678', '06 12 34 56 78', '+212612345678', '00212612345678', '0522123456']) expect(ok(v), v).toBe(true);
  });

  it('rejects everything else', () => {
    for (const v of ['', '12345', '+33612345678', '0412345678', '06123456789', 'abcdefghij']) expect(ok(v), v).toBe(false);
  });
});
