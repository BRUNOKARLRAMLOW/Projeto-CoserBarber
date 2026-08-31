import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

const WHATSAPP_NUMBER = '5547999999987';
const INSTAGRAM_URL = 'https://www.instagram.com/coserbarber/';

@Component({
  selector: 'app-contato',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './contato.html',
  styleUrl: './contato.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ContatoComponent {
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    nome:     ['', [Validators.required, Validators.minLength(2)]],
    mensagem: ['', [Validators.required, Validators.minLength(10)]],
  });

  readonly instagramUrl = INSTAGRAM_URL;

  enviarWhatsApp(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nome, mensagem } = this.form.getRawValue();
    const textoCompleto = `Olá! Meu nome é ${nome}.\n\n${mensagem}`;
    const encoded = encodeURIComponent(textoCompleto);
    const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encoded}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    this.form.reset();
  }
}
