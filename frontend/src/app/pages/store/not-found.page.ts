import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';
import { TPipe } from '../../shared/pipes/i18n.pipes';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container empty-state nf">
      <div class="big">404</div>
      <h3>{{ 'notfound.title' | t }}</h3>
      <p class="muted">{{ 'notfound.desc' | t }}</p>
      <a routerLink="/" class="btn btn-primary btn-lg"><app-icon name="home" [size]="18" /> {{ 'confirm.home' | t }}</a>
    </div>
  `,
  styles: `
    .nf {
      padding-block: 6rem;
    }
    .big {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: clamp(5rem, 18vw, 9rem);
      line-height: 1;
      background: var(--grad);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
  `,
})
export class NotFoundPage {}
