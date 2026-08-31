import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { AgendaService, obterProximoSlot } from '@core/services/agenda.service';
import { AuthService } from '@core/services/auth.service';
import type { Servico, Agendamento } from '@core/models';

interface CalendarDay {
  date: string;       // YYYY-MM-DD
  day: number;
  isToday: boolean;
  isPast: boolean;
  isClosed: boolean;  // Domingo
  isSaturday: boolean;
  isFull: boolean;
}

@Component({
  selector: 'app-agenda',
  imports: [ReactiveFormsModule, AsyncPipe, UpperCasePipe],
  templateUrl: './agenda.html',
  styleUrl: './agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AgendaComponent {
  private readonly svc = inject(AgendaService);
  private readonly fb = inject(FormBuilder);
  public readonly auth = inject(AuthService);

  readonly servicos$ = this.svc.servicos$;

  // ── Estado do Calendário ─────────────────────────────────────
  private readonly _today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  readonly viewDate = signal(
    new Date(this._today.getFullYear(), this._today.getMonth(), 1)
  );
  readonly selectedDate = signal<string | null>(null);
  readonly baseSlotsDoDia = signal<string[]>([]);
  readonly horariosDisponiveis = signal<string[]>([]);

  // ── Estado do Barbeiro ───────────────────────────────────────
  readonly barbeiroSelecionado = signal<'coser' | 'filippi' | ''>('');
  readonly servicoSelecionado = signal<string>('');
  readonly salvando = signal(false);

  constructor() {
    // Sempre que o barbeiro ou serviço mudar, recalcula os horários
    this.form.controls.barbeiroId.valueChanges.subscribe((b) => {
      this.barbeiroSelecionado.set(b as 'coser' | 'filippi' | '');
      this.recalcularHorarios();
    });

    this.form.controls.servicoId.valueChanges.subscribe((s) => {
      this.servicoSelecionado.set(s || '');
      this.recalcularHorarios();
    });

    // Também reage à mudança de agendamentos no banco
    effect(() => {
      const _ = this.svc.agendamentos();
      this.recalcularHorarios();
    });

    // Efeito para preencher o nome do cliente logado reativamente e gerenciar validadores do telefone
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.form.controls.clienteNome.setValue(user.displayName);
        this.form.controls.clienteTelefone.clearValidators();
      } else {
        this.form.controls.clienteNome.setValue('');
        this.form.controls.clienteTelefone.setValidators([Validators.required, Validators.minLength(8)]);
      }
      this.form.controls.clienteTelefone.updateValueAndValidity();
    });
  }

  private recalcularHorarios(): void {
    const data = this.selectedDate();
    const barbeiro = this.barbeiroSelecionado();
    const servico = this.servicoSelecionado();

    if (data && barbeiro && servico) {
      this.baseSlotsDoDia.set(
        this.svc.obterBaseSlotsDoDia(data, barbeiro)
      );
      this.horariosDisponiveis.set(
        this.svc.obterHorariosDisponiveis(data, barbeiro, servico)
      );
      const current = this.form.controls.horario.value;
      if (current && !this.horariosDisponiveis().includes(current)) {
        this.form.controls.horario.setValue('');
      }
    } else {
      this.baseSlotsDoDia.set([]);
      this.horariosDisponiveis.set([]);
    }
  }

  selecionarBarbeiro(id: 'coser' | 'filippi'): void {
    this.form.controls.barbeiroId.setValue(id);
    this.selectedDate.set(null);
    this.form.controls.horario.setValue('');
  }

  // ── Estado de Confirmação ────────────────────────────────────
  readonly agendado = signal(false);
  readonly nomeAgendado = signal('');
  readonly barbeiroAgendado = signal('');
  readonly servicoAgendado = signal<Servico | undefined>(undefined);
  readonly precoPago = signal<number>(0);
  readonly dataAgendada = signal('');
  readonly horarioAgendado = signal('');
  readonly telefoneAgendado = signal('');

  // ── Formulário ───────────────────────────────────────────────
  readonly form = this.fb.nonNullable.group({
    clienteNome: ['', [Validators.required, Validators.minLength(2)]],
    barbeiroId:  ['', [Validators.required]],
    servicoId:   ['', [Validators.required]],
    horario:     ['', [Validators.required]],
    clienteTelefone: [''],
  });

  // ── Computed: cabeçalho do mês ───────────────────────────────
  readonly mesAno = computed(() =>
    this.viewDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  );

  readonly canGoPrev = computed(() => {
    const now = new Date(this._today.getFullYear(), this._today.getMonth(), 1);
    return this.viewDate() > now;
  });

  // ── Computed: grade do calendário ────────────────────────────
  readonly calendarDays = computed((): (CalendarDay | null)[] => {
    const view  = this.viewDate();
    const year  = view.getFullYear();
    const month = view.getMonth();

    const firstDay     = new Date(year, month, 1);
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const today        = this._today;

    // Semana brasileira começa na segunda (1=Seg…0=Dom → índice 0–6)
    const rawOffset = firstDay.getDay(); // 0=Dom
    const offset    = rawOffset === 0 ? 6 : rawOffset - 1;

    const grid: (CalendarDay | null)[] = Array(offset).fill(null);

    const barbeiro = this.barbeiroSelecionado();
    const servico = this.servicoSelecionado();
    
    // Depende reativamente das alterações de agendamentos no banco
    const _ = this.svc.agendamentos();

    // Verificação de plano Silver ou Gold
    const user = this.auth.currentUser();
    const isPlanRestricted = user && (user.plan === 'silver' || user.plan === 'gold');

    for (let d = 1; d <= daysInMonth; d++) {
      const date      = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const dateStr   = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const isPast = date < today;
      let isClosed = false;
      if (barbeiro) {
        isClosed = this.svc.isDiaClosedParaBarbeiro(dateStr, barbeiro as 'coser' | 'filippi');
      } else {
        isClosed = dayOfWeek === 0 || dayOfWeek === 1;
      }
      
      // Restringir assinantes Silver/Gold apenas para Terça (2), Quarta (3) e Quinta (4)
      if (isPlanRestricted && dayOfWeek !== 2 && dayOfWeek !== 3 && dayOfWeek !== 4) {
        isClosed = true;
      }

      let isFull = false;
      if (barbeiro && servico && !isPast && !isClosed) {
        isFull = this.svc.obterHorariosDisponiveis(dateStr, barbeiro as 'coser' | 'filippi', servico).length === 0;
      }

      grid.push({
        date:       dateStr,
        day:        d,
        isToday:    date.getTime() === today.getTime(),
        isPast,
        isClosed,
        isSaturday: dayOfWeek === 6,
        isFull,
      });
    }

    return grid;
  });

  // ── Navegação de Mês ─────────────────────────────────────────
  prevMonth(): void {
    if (!this.canGoPrev()) return;
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    this.clearSelection();
  }

  nextMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    this.clearSelection();
  }

  // ── Seleção de Dia ───────────────────────────────────────────
  selectDay(day: CalendarDay): void {
    if (day.isPast || day.isClosed || day.isFull) return;

    // Dupla validação de segurança para assinantes Silver/Gold
    const user = this.auth.currentUser();
    if (user && (user.plan === 'silver' || user.plan === 'gold')) {
      const [y, m, d] = day.date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 2 && dayOfWeek !== 3 && dayOfWeek !== 4) {
        alert('Assinantes dos planos Silver e Gold só podem agendar de terça a quinta-feira.');
        return;
      }
    }

    this.selectedDate.set(day.date);
    const barbeiro = this.barbeiroSelecionado() as 'coser' | 'filippi';
    const servico = this.servicoSelecionado();
    
    if (barbeiro && servico) {
      this.baseSlotsDoDia.set(this.svc.obterBaseSlotsDoDia(day.date, barbeiro));
      this.horariosDisponiveis.set(this.svc.obterHorariosDisponiveis(day.date, barbeiro, servico));
    }
    this.form.controls.horario.setValue('');
  }

  private clearSelection(): void {
    this.selectedDate.set(null);
    this.horariosDisponiveis.set([]);
    this.form.controls.horario.setValue('');
  }

  selecionarHorario(horario: string): void {
    if (this.horariosDisponiveis().includes(horario)) {
      this.form.controls.horario.setValue(horario);
      this.form.controls.horario.markAsTouched();
    }
  }

  // ── Confirmar Agendamento ────────────────────────────────────
  async confirmar(): Promise<void> {
    if (this.form.invalid || !this.selectedDate()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.salvando()) return;
    this.salvando.set(true);

    try {
      const { clienteNome, barbeiroId, servicoId, horario, clienteTelefone } = this.form.getRawValue();
      const data = this.selectedDate()!;
      const user = this.auth.currentUser();

      // Consulta o banco de dados antes de agendar para evitar agendamentos simultâneos
      const disponivel = await this.svc.verificarDisponibilidade(
        data,
        barbeiroId as 'coser' | 'filippi',
        horario,
        servicoId
      );
      if (!disponivel) {
        alert('Desculpe, este horário já foi agendado por outro cliente ou está bloqueado. O site será atualizado.');
        window.location.reload();
        return;
      }

      let usouPlano = false;
      if (user && servicoId !== '2') { // Barba (id: '2') não é coberta pelo plano
        if (user.plan === 'gold' || user.plan === 'vip') {
          usouPlano = true;
        } else if (user.plan === 'silver') {
          const cutsLeft = user.planHaircutsLeft ?? 0;
          if (cutsLeft > 0) {
            usouPlano = true;
            try {
              await this.auth.atualizarPlanoUsuario(user.uid, 'silver', cutsLeft - 1);
              console.log(`[AgendaComponent] 1 crédito descontado do plano Silver. Novo saldo: ${cutsLeft - 1}`);
            } catch (err) {
              console.error('[AgendaComponent] Erro ao descontar crédito do plano Silver:', err);
              alert('Ocorreu um erro ao processar o seu plano Silver. Por favor, tente novamente.');
              return;
            }
          } else {
            const prosseguir = confirm('Você já utilizou os 2 cortes mensais deste plano. Deseja realizar este agendamento fora do plano (pagamento presencial na barbearia)?');
            if (!prosseguir) return;
          }
        }
      }

      const dadosAgendamento: Omit<Agendamento, 'id'> = {
        clienteNome,
        barbeiroId: barbeiroId as 'coser' | 'filippi',
        servicoId,
        data,
        horario,
        usouPlano,
        ...(clienteTelefone ? { clienteTelefone } : {}),
        ...(user?.uid ? { clienteUid: user.uid } : {})
      };
      await this.svc.salvarAgendamento(dadosAgendamento);

      const servicoObj = this.svc.obterServicoPorId(servicoId);
      if (servicoObj) {
        this.precoPago.set(this.obterPrecoFinalServico(servicoObj));
      }

      this.nomeAgendado.set(clienteNome);
      this.barbeiroAgendado.set(barbeiroId === 'coser' ? 'Davi Coser' : 'Filippi');
      this.servicoAgendado.set(servicoObj);
      this.dataAgendada.set(this.formatarDataCompleta(data));
      this.horarioAgendado.set(`${horario} - ${this.obterFimSlot(horario, servicoId)}`);
      this.telefoneAgendado.set(clienteTelefone || '');
      this.agendado.set(true);

      this.form.reset();
      this.barbeiroSelecionado.set('');
      this.servicoSelecionado.set('');
      this.clearSelection();
    } catch (err) {
      console.error('Erro ao confirmar agendamento:', err);
    } finally {
      this.salvando.set(false);
    }
  }

  novoAgendamento(): void {
    this.agendado.set(false);
  }

  obterFimSlot(slot: string, servicoId: string): string {
    const next = obterProximoSlot(slot);
    if (servicoId === '3') {
      return obterProximoSlot(next);
    }
    return next;
  }

  formatarPreco(preco: number): string {
    return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  obterPrecoFinalServico(servico: Servico): number {
    const user = this.auth.currentUser();
    if (!user || !user.plan || user.plan === 'none') {
      return servico.preco;
    }

    // Corte (id: '1')
    if (servico.id === '1') {
      if (user.plan === 'gold' || user.plan === 'vip') {
        return 0;
      }
      if (user.plan === 'silver' && (user.planHaircutsLeft ?? 0) > 0) {
        return 0;
      }
      return servico.preco;
    }

    // Barba (id: '2')
    if (servico.id === '2') {
      return servico.preco;
    }

    // Corte + Barba (id: '3')
    if (servico.id === '3') {
      if (user.plan === 'gold' || user.plan === 'vip') {
        return servico.preco / 2; // Metade do preço
      }
      if (user.plan === 'silver' && (user.planHaircutsLeft ?? 0) > 0) {
        return servico.preco / 2; // Metade do preço se houver créditos
      }
      return servico.preco;
    }

    return servico.preco;
  }

  private formatarDataCompleta(data: string): string {
    const [ano, mes, dia] = data.split('-').map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  obterHorariosDescricao(barbeiroId: 'coser' | 'filippi'): string[] {
    const config = this.svc.configs()[barbeiroId];
    if (!config || !config.dias) {
      return barbeiroId === 'coser' 
        ? ['Ter a Sex: 09:00 - 20:00', 'Sáb: 08:00 - 16:00']
        : ['Ter a Sex: 09:00 - 13:30', 'Sáb: 08:00 - 16:00'];
    }

    const ativas: string[] = [];
    const diasOrdem = [1, 2, 3, 4, 5, 6, 0];
    
    let startDayIdx = -1;
    let endDayIdx = -1;
    let currentHours = '';

    const formatRange = (start: number, end: number, hours: string) => {
      const getDiaNameShort = (idx: number) => {
        const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return names[idx];
      };
      if (start === end) {
        return `${getDiaNameShort(start)}: ${hours}`;
      }
      return `${getDiaNameShort(start)} a ${getDiaNameShort(end)}: ${hours}`;
    };

    diasOrdem.forEach((idx) => {
      const dia = config.dias[idx];
      if (dia && dia.ativo) {
        const hours = `${dia.inicio} - ${dia.fim}`;
        if (hours === currentHours && (idx === endDayIdx + 1 || (endDayIdx === 6 && idx === 0))) {
          endDayIdx = idx;
        } else {
          if (startDayIdx !== -1) {
            ativas.push(formatRange(startDayIdx, endDayIdx, currentHours));
          }
          startDayIdx = idx;
          endDayIdx = idx;
          currentHours = hours;
        }
      } else {
        if (startDayIdx !== -1) {
          ativas.push(formatRange(startDayIdx, endDayIdx, currentHours));
          startDayIdx = -1;
          endDayIdx = -1;
          currentHours = '';
        }
      }
    });

    if (startDayIdx !== -1) {
      ativas.push(formatRange(startDayIdx, endDayIdx, currentHours));
    }

    return ativas.length > 0 ? ativas : ['Sem expediente definido'];
  }
}
