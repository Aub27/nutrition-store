import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const ICONS: Record<string, string[]> = {
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.3-4.3'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  cart: ['M6 6h15l-1.6 9H7.6z', 'M6 6 5 3H2', 'M9.5 20.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0', 'M16.5 20.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
  mail: ['M3 6h18v12H3z', 'm3 7 9 7 9-7'],
  pin: ['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  truck: ['M2 6h12v10H2z', 'M14 10h4l3 3v3h-7z', 'M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  shield: ['M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z', 'm9 12 2 2 4-4'],
  cash: ['M3 7h18v10H3z', 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M6 10v4', 'M18 10v4'],
  chat: ['M4 5h16v11H9l-5 4z'],
  check: ['m5 12 5 5 9-10'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-up': ['m6 15 6-6 6 6'],
  'chevron-right': ['m9 6 6 6-6 6'],
  'chevron-left': ['m15 6-6 6 6 6'],
  'arrow-right': ['M5 12h14', 'm13 6 6 6-6 6'],
  'arrow-left': ['M19 12H5', 'm11 6-6 6 6 6'],
  'arrow-up': ['M12 19V5', 'm6 11 6-6 6 6'],
  'arrow-down': ['M12 5v14', 'm18 13-6 6-6-6'],
  flame: ['M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'],
  bolt: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  leaf: ['M5 19C5 10 10 5 20 4c0 10-5 15-14 15z', 'M5 19c3-5 6-7 10-9'],
  apple: ['M12 7c-3-2-8 0-8 6 0 4 3 8 5 8 1 0 2-.7 3-.7s2 .7 3 .7c2 0 5-4 5-8 0-6-5-8-8-6z', 'M12 7c0-2 1-4 3-4'],
  dumbbell: ['M6 8v8', 'M3 10v4', 'M18 8v8', 'M21 10v4', 'M6 12h12'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  tag: ['M3 12V4h8l10 10-8 8z', 'M7.5 8.5h.01'],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'],
  star: ['m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  filter: ['M3 5h18l-7 8v6l-4-2v-4z'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3c3 3 3 15 0 18', 'M12 3c-3 3-3 15 0 18'],
  package: ['M12 3l9 4.5v9L12 21l-9-4.5v-9z', 'M3 7.5 12 12l9-4.5', 'M12 12v9'],
  image: ['M4 5h16v14H4z', 'm4 16 5-5 4 4 3-3 4 4', 'M9 9.5h.01'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'm13.5 6.5 4 4'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  'eye-off': ['M3 3l18 18', 'M10.6 6.1A9.5 9.5 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6', 'M6.2 7.2A17 17 0 0 0 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1'],
  bell: ['M6 17v-6a6 6 0 0 1 12 0v6l2 2H4z', 'M10 21h4'],
  inbox: ['M3 13l3-8h12l3 8v6H3z', 'M3 13h5l1 3h6l1-3h5'],
  sliders: ['M4 7h10', 'M18 7h2', 'M4 17h2', 'M10 17h10', 'M16 7a2 2 0 1 0 0 .01', 'M8 17a2 2 0 1 0 0 .01'],
  logout: ['M9 4H5v16h4', 'M16 8l4 4-4 4', 'M20 12H9'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  alert: ['M12 3 2 20h20z', 'M12 10v4', 'M12 17h.01'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  lock: ['M5 11h14v10H5z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 20h16'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 4-6 8-6s8 2 8 6'],
  instagram: ['M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M17.5 6.5h.01'],
  facebook: ['M15 3h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z'],
  whatsapp: ['M3 21l1.6-4.8A9 9 0 1 1 8 19.6z', 'M9 9c0 3 3 6 6 6l1-2-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2z'],
  trending: ['m3 17 6-6 4 4 8-8', 'M15 7h6v6'],
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  drag: ['M9 6h.01', 'M9 12h.01', 'M9 18h.01', 'M15 6h.01', 'M15 12h.01', 'M15 18h.01'],
  heart: ['M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z'],
  tub: ['M6 8h12v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z', 'M5 4h14v4H5z', 'M9 13h6', 'M9 17h6'],
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly stroke = input(1.9);
  protected readonly paths = computed(() => ICONS[this.name()] ?? []);
}
