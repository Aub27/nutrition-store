import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { mediaUrl } from '../../core/services/media';
import { IconComponent } from './icon.component';

/** Product/category picture, with a branded gradient placeholder while there is no real photo yet. */
@Component({
  selector: 'app-media',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as s) {
      <img [src]="s" [alt]="alt()" loading="lazy" decoding="async" />
    } @else {
      <div class="ph" [style.--h]="hue()" role="img" [attr.aria-label]="alt()">
        <span class="ph-orb"></span>
        <app-icon name="tub" [size]="iconSize()" [stroke]="1.4" />
        @if (label()) {
          <small>{{ label() }}</small>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ph {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100%;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 0.4rem;
      color: rgba(255, 255, 255, 0.95);
      overflow: hidden;
      background: linear-gradient(135deg, hsl(var(--h) 65% 38%) 0%, hsl(calc(var(--h) + 30) 70% 46%) 100%);
    }
    .ph-orb {
      position: absolute;
      inset: auto -20% -35% auto;
      width: 80%;
      aspect-ratio: 1;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.35), transparent 65%);
    }
    small {
      position: relative;
      font-weight: 700;
      letter-spacing: 0.08em;
      font-size: 0.7rem;
      text-transform: uppercase;
      max-width: 85%;
      text-align: center;
      opacity: 0.9;
    }
  `,
})
export class MediaComponent {
  readonly url = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly label = input('');
  readonly seed = input(0);
  readonly iconSize = input(54);
  protected readonly src = computed(() => mediaUrl(this.url()));
  // Green → lime range only, so placeholders always match the brand.
  protected readonly hue = computed(() => 95 + ((this.seed() * 23) % 75));
}
