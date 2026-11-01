import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { MediaComponent } from '../../../shared/components/media.component';
import { checkImageFile } from './format';
import { errorMessage } from './http-error';

/** Drag & drop / click image uploader. Validates type + size client-side, then uploads through the admin API. */
@Component({
  selector: 'adm-image-uploader',
  imports: [IconComponent, MediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="up" [class.has]="!!url()" [class.drag]="dragging()" [class.sq]="square()">
      <div
        class="drop"
        role="button"
        tabindex="0"
        [attr.aria-label]="label()"
        (click)="file.click()"
        (keydown.enter)="file.click()"
        (keydown.space)="$event.preventDefault(); file.click()"
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        @if (url()) {
          <app-media [url]="url()" [alt]="label()" [iconSize]="40" />
          <span class="over"><app-icon name="upload" [size]="20" /> Remplacer</span>
        } @else {
          <div class="empty">
            <span class="orb"><app-icon name="image" [size]="26" /></span>
            <strong>Glissez une image ici</strong>
            <small>ou cliquez pour parcourir · JPEG, PNG, WebP · 5 Mo max</small>
          </div>
        }
        @if (busy()) {
          <div class="busy" role="status"><span class="spinner"></span> Envoi en cours…</div>
        }
      </div>
      <input #file type="file" hidden accept="image/jpeg,image/png,image/webp" (change)="onPick($event)" />
      @if (url()) {
        <button type="button" class="rm" (click)="remove()">
          <app-icon name="trash" [size]="15" /> Retirer l'image
        </button>
      }
      @if (error()) {
        <p class="field-error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .up {
      display: grid;
      gap: 0.6rem;
      justify-items: start;
    }
    .drop {
      position: relative;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border: 2px dashed var(--p-200);
      border-radius: var(--r);
      background: var(--grad-soft);
      overflow: hidden;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    }
    .sq .drop {
      aspect-ratio: 1;
      max-inline-size: 260px;
    }
    .drop:hover,
    .drag .drop {
      border-color: var(--p-400);
      box-shadow: 0 0 0 5px rgba(63, 203, 116, 0.14);
    }
    .has .drop {
      border-style: solid;
      border-color: var(--line);
    }
    .empty {
      display: grid;
      justify-items: center;
      gap: 0.3rem;
      padding: 1rem;
      text-align: center;
    }
    .empty strong {
      color: var(--ink-2);
    }
    .empty small {
      color: var(--muted);
      font-size: 0.78rem;
    }
    .orb {
      inline-size: 54px;
      block-size: 54px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: #fff;
      color: var(--p-500);
      box-shadow: var(--sh);
      margin-block-end: 0.3rem;
    }
    .over {
      position: absolute;
      inset: auto 0 0 0;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.4rem;
      padding: 0.6rem;
      color: #fff;
      font-weight: 650;
      font-size: 0.85rem;
      background: linear-gradient(transparent, rgba(6, 25, 15, 0.75));
      opacity: 0;
      transition: opacity 0.25s;
    }
    .drop:hover .over,
    .drop:focus-visible .over {
      opacity: 1;
    }
    .busy {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      background: rgba(6, 25, 15, 0.62);
      color: #fff;
      font-weight: 650;
      backdrop-filter: blur(3px);
    }
    .rm {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.82rem;
      font-weight: 650;
      color: var(--danger);
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      transition: background 0.2s;
    }
    .rm:hover {
      background: #fff0f2;
    }
  `,
})
export class ImageUploaderComponent {
  private api = inject(AdminApiService);
  private toast = inject(ToastService);

  readonly url = input<string | null>(null);
  readonly label = input('Image');
  readonly square = input(false);
  readonly urlChange = output<string | null>();
  readonly uploading = output<boolean>();

  protected readonly busy = signal(false);
  protected readonly dragging = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragging.set(false);
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.upload(f);
  }

  protected onPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) this.upload(f);
  }

  protected remove(): void {
    this.error.set(null);
    this.urlChange.emit(null);
  }

  private upload(file: File): void {
    const problem = checkImageFile(file);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    this.uploading.emit(true);
    this.api.upload(file).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.uploading.emit(false);
        this.urlChange.emit(r.url);
      },
      error: (e) => {
        this.busy.set(false);
        this.uploading.emit(false);
        const msg = errorMessage(e, "Échec de l'envoi de l'image.");
        this.error.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
