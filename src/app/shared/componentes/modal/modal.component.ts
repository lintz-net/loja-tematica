import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
  @Input() aberto = false;
  @Input() titulo = '';
  @Output() fechar = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  aoPressionarEsc(): void {
    if (this.aberto) {
      this.fechar.emit();
    }
  }

  fecharPorBackdrop(): void {
    this.fechar.emit();
  }
}
