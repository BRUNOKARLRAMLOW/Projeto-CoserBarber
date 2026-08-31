import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-planos',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './planos.html',
  styleUrl: './planos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PlanosComponent {
  public readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ── Estado do Modal de Checkout Simulado ────────────────────
  readonly showCheckout = signal(false);
  readonly selectedPlanId = signal<'silver' | 'gold' | null>(null);
  readonly isProcessing = signal(false);
  readonly successMessage = signal<string | null>(null);

  readonly plans = [
    {
      id: 'none' as const,
      name: 'Sem Plano (Avulso)',
      price: 0,
      description: 'Para quem prefere pagar individualmente por cada serviço realizado.',
      benefits: [
        'Sem taxa mensal ou cobrança recorrente',
        'Paga o valor cheio de cada serviço no dia',
        'Reserva de horários online flexível',
        'Sem benefícios exclusivos de clube'
      ],
      accentColor: 'none'
    },
    {
      id: 'silver' as const,
      name: 'Silver',
      price: 60,
      description: 'Ideal para quem mantém o visual alinhado quinzenalmente.',
      benefits: [
        '2 cortes de cabelo no mês',
        'Reseta todo dia 15 (não cumulativo)',
        'Agendamento online flexível',
        'Sem taxa de adesão ou fidelidade'
      ],
      accentColor: 'silver'
    },
    {
      id: 'gold' as const,
      name: 'Gold',
      price: 90,
      description: 'O melhor custo-benefício para quem quer cortar cabelo sem limites.',
      benefits: [
        'Cortes de cabelo ILIMITADOS no mês',
        'Corte à vontade em qualquer dia ativo',
        'Prioridade na escolha de horários',
        'Sem taxa de adesão ou fidelidade'
      ],
      accentColor: 'gold'
    }
  ];

  get selectedPlan() {
    return this.plans.find(p => p.id === this.selectedPlanId());
  }

  abrirCheckout(planId: 'silver' | 'gold'): void {
    const user = this.auth.currentUser();
    if (!user) {
      // Se não estiver logado, redireciona para a tela de login
      this.router.navigate(['/login'], { queryParams: { redirect: 'planos' } });
      return;
    }
    this.selectedPlanId.set(planId);
    this.showCheckout.set(true);
    this.successMessage.set(null);
  }

  fecharCheckout(): void {
    if (this.isProcessing()) return;
    this.showCheckout.set(false);
    this.selectedPlanId.set(null);
  }

  async confirmarAssinatura(): Promise<void> {
    const user = this.auth.currentUser();
    const planId = this.selectedPlanId();
    if (!user || !planId) return;

    this.isProcessing.set(true);

    try {
      // Simula uma espera de processamento de pagamento do Pix/Cartão de 2 segundos
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Atualiza o plano no Firestore
      await this.auth.atualizarPlanoUsuario(user.uid, planId);
      
      this.successMessage.set(`Parabéns! Sua assinatura do Plano ${planId === 'silver' ? 'Silver' : 'Gold'} foi ativada com sucesso!`);
      this.isProcessing.set(false);

      // Fecha o checkout automaticamente após 3 segundos
      setTimeout(() => {
        this.fecharCheckout();
        this.successMessage.set(null);
      }, 3500);
    } catch (err: any) {
      console.error('Erro ao contratar plano:', err);
      alert('Erro ao processar assinatura: ' + (err?.message || err));
      this.isProcessing.set(false);
    }
  }

  async cancelarAssinatura(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    const conf = confirm('Tem certeza que deseja cancelar sua assinatura atual e voltar a ser Cliente Avulso? Seus créditos de cortes restantes serão perdidos.');
    if (!conf) return;

    try {
      await this.auth.atualizarPlanoUsuario(user.uid, 'none');
      alert('Sua assinatura foi cancelada com sucesso. Você voltou ao status de Cliente Avulso.');
    } catch (err: any) {
      console.error('Erro ao cancelar assinatura:', err);
      alert('Erro ao cancelar assinatura: ' + (err?.message || err));
    }
  }

  formatarPreco(valor: number): string {
    if (valor === 0) return 'Grátis';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
