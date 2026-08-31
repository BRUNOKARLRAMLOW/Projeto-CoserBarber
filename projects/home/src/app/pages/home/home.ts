import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { AgendaService } from '@core/services/agenda.service';

interface FotoGaleria {
  src: string;
  alt: string;
  categoria: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, AsyncPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomeComponent {
  private readonly agendaSvc = inject(AgendaService);

  readonly servicos$ = this.agendaSvc.servicos$;
  readonly instagramUrl = 'https://www.instagram.com/coserbarber/';
  readonly anosExperiencia = new Date().getFullYear() - 2022;

  readonly galeria: FotoGaleria[] = [
    {
      src: 'gallery/corte-1.jpg',
      alt: 'Corte degradê com estrela navalhada na lateral',
      categoria: 'Degradê + Arte',
    },
    {
      src: 'gallery/corte-2.jpg',
      alt: 'Dois clientes com degradê moderno e riscos exclusivos',
      categoria: 'Degradê e Degradê + Arte',
    },
    {
      src: 'gallery/corte-3.jpg',
      alt: 'Corte em cabelo cacheado com arte navalhada na lateral',
      categoria: 'Mullet + Arte',
    },
  ];

  formatarPreco(preco: number): string {
    return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
