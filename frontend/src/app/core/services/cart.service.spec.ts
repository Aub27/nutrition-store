import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CartService } from './cart.service';
import { Product } from '../../shared/models';

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: 1,
    category_id: 1,
    name_fr: 'Whey',
    name_ar: null,
    slug: 'whey',
    price: '200.00',
    options: [],
    image_url: null,
    ...over,
  }) as Product;

function setup(stored?: unknown) {
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem('ns_cart_v1', typeof stored === 'string' ? stored : JSON.stringify(stored));
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { cart: TestBed.inject(CartService), http: TestBed.inject(HttpTestingController) };
}

describe('CartService', () => {
  it('merges identical lines and counts items', () => {
    const { cart } = setup();
    cart.add(product(), 1);
    cart.add(product(), 2);
    expect(cart.entries().length).toBe(1);
    expect(cart.itemCount()).toBe(3);
    expect(cart.subtotal()).toBe(600);
  });

  it('keeps variants as separate lines and ignores options for products without any', () => {
    const { cart } = setup();
    const p = product({ options: ['Vanille', 'Chocolat'] });
    cart.add(p, 1, 'Vanille');
    cart.add(p, 1, 'Chocolat');
    cart.add(product({ id: 2, slug: 'bar' }), 1, 'ignored');
    expect(cart.entries().map((e) => e.option)).toEqual(['Vanille', 'Chocolat', null]);
  });

  it('caps quantities and removes a line at zero', () => {
    const { cart } = setup();
    cart.add(product(), 1);
    cart.setQuantity(1, null, 999);
    expect(cart.entries()[0].quantity).toBe(20);
    cart.setQuantity(1, null, 0);
    expect(cart.isEmpty()).toBe(true);
  });

  it('discards tampered localStorage content', () => {
    const { cart } = setup([
      { product_id: -5, quantity: 1, slug: 'x', name_fr: 'x' },
      { product_id: 3, quantity: 'many', slug: 'x', name_fr: 'x' },
      { product_id: 4, quantity: 500, slug: 'ok', name_fr: 'OK', unit_price: '12' },
      'not-an-object',
    ]);
    expect(cart.entries().length).toBe(1);
    expect(cart.entries()[0].quantity).toBe(20);
  });

  it('survives corrupted JSON', () => {
    const { cart } = setup('{not json');
    expect(cart.isEmpty()).toBe(true);
  });

  it('uses the server quote for totals', () => {
    const { cart, http } = setup();
    cart.add(product(), 2);
    cart.refresh();
    const req = http.expectOne((r) => r.url.endsWith('/cart/quote'));
    req.flush({
      lines: [{ product_id: 1, slug: 'whey', name_fr: 'Whey', name_ar: null, image_url: null, option: null, unit_price: '180.00', compare_at_price: null, quantity: 2, line_total: '360.00', available: true, max_quantity: null, issue: null }],
      subtotal: '360.00',
      delivery_fee: '30.00',
      total: '390.00',
      free_delivery: false,
      free_delivery_threshold: '500.00',
      amount_to_free_delivery: '140.00',
      all_available: true,
    });
    expect(cart.subtotal()).toBe(360);
    expect(cart.total()).toBe(390);
    expect(cart.amountToFree()).toBe(140);
  });
});
