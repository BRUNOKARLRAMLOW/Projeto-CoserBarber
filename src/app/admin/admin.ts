import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  OnDestroy,
} from '@angular/core';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@core/services/agenda.service';
import type { UserProfile } from '@core/services/auth.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AgendaService } from '@core/services/agenda.service';
import { AuthService } from '@core/services/auth.service';
import type { Agendamento, BarbeiroConfig, DiaConfig, ProdutoAdicional } from '@core/models';

interface AdminCalendarDay {
  date: string;
  day: number;
  isToday: boolean;
  isClosed: boolean;
  temAgendamento: boolean;
}

interface TimelineSlot {
  horario: string;
  isClosed: boolean;
  agendamento?: Agendamento;
  isContinuation?: boolean;
  continuationOf?: Agendamento;
}

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminComponent implements OnDestroy {
  private readonly svc = inject(AgendaService);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  // ── Novo Estado de Controle Administrativo (Planos & Abas) ──
  readonly activeAdminTab = signal<'agenda' | 'clientes' | 'expediente'>('agenda');
  readonly clients = signal<UserProfile[]>([]);
  private unsubscribeUsers: (() => void) | null = null;

  // ── Estado do Agendamento Especial Sem Cadastro ────────────────
  readonly showSpecialBookingModal = signal<boolean>(false);
  readonly specialBookingNome = signal<string>('');
  readonly specialBookingCategoria = signal<'idoso' | 'pcd' | 'vip' | 'outro'>('idoso');
  readonly specialBookingServicoId = signal<string>('1');
  readonly specialBookingBarbeiroId = signal<'coser' | 'filippi'>('coser');
  readonly specialBookingData = signal<string>('');
  readonly specialBookingHorario = signal<string>('');
  readonly specialBookingPreco = signal<number>(35);

  readonly availableSlotsForSpecialBooking = computed(() => {
    const data = this.specialBookingData();
    const barbeiroId = this.specialBookingBarbeiroId();
    const servicoId = this.specialBookingServicoId();
    if (!data || !barbeiroId || !servicoId) return [];
    return this.svc.obterHorariosDisponiveis(data, barbeiroId, servicoId);
  });

  // ── Estado do Login ──────────────────────────────────────────
  readonly isAuthInitializing = this.authService.isInitializing;
  readonly isAuthenticated = signal<boolean>(false);
  readonly loginError = signal<string | null>(null);
  readonly loggedBarber = signal<'coser' | 'filippi' | null>(null);

  // ── Estado de Configuração de Expediente ─────────────────────
  readonly activeConfig = signal<BarbeiroConfig | null>(null);
  readonly isSavingConfig = signal<boolean>(false);
  readonly salvandoEspecial = signal(false);
  readonly configSuccess = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  // ── Filtros e Navegação da Agenda ────────────────────────────
  readonly filtroData = signal<string>(
    (() => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })()
  );

  readonly barbeiroFiltro = signal<'all' | 'coser' | 'filippi'>('all');
  readonly slotExpandido = signal<string | null>(null);
  
  readonly viewDate = signal(new Date());

  readonly mesAno = computed(() =>
    this.viewDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  );

  prevMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  selecionarDia(date: string): void {
    this.filtroData.set(date);
    this.slotExpandido.set(null);
  }

  toggleExpandirSlot(id: string, agendamentoRef?: Agendamento): void {
    if (this.slotExpandido() === id) {
      this.slotExpandido.set(null);
    } else {
      if (agendamentoRef) {
        const listaOriginal = agendamentoRef.produtos && agendamentoRef.produtos.length > 0
          ? JSON.parse(JSON.stringify(agendamentoRef.produtos))
          : [{ nome: '', quantidade: 1, valor: 0 }];
        
        this.produtosSendoEditados.update(prev => ({
          ...prev,
          [id]: listaOriginal
        }));

        let precoInicial = agendamentoRef.precoCustomizado;
        if (precoInicial === undefined || precoInicial === null) {
          const service = this.svc.obterServicoPorId(agendamentoRef.servicoId);
          if (service) {
            if (agendamentoRef.usouPlano) {
              precoInicial = agendamentoRef.servicoId === '3' ? service.preco / 2 : 0;
            } else {
              precoInicial = service.preco;
            }
          } else {
            precoInicial = 0;
          }
        }
        this.precosSendoEditados.update(prev => ({
          ...prev,
          [id]: precoInicial
        }));
      }
      this.slotExpandido.set(id);
    }
  }

  // ── Computado: Grade do Calendário Administrativo ────────────
  readonly calendarDays = computed((): (AdminCalendarDay | null)[] => {
    const view  = this.viewDate();
    const year  = view.getFullYear();
    const month = view.getMonth();

    const firstDay     = new Date(year, month, 1);
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const today        = new Date();
    today.setHours(0, 0, 0, 0);

    const rawOffset = firstDay.getDay(); // 0=Dom
    const offset    = rawOffset === 0 ? 6 : rawOffset - 1;

    const grid: (AdminCalendarDay | null)[] = Array(offset).fill(null);
    const todosAgendamentos = this.svc.agendamentos();

    for (let d = 1; d <= daysInMonth; d++) {
      const date      = new Date(year, month, d);
      const dayOfWeek = date.getDay();
      const dateStr   = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const isToday = date.getFullYear() === today.getFullYear() &&
                      date.getMonth() === today.getMonth() &&
                      date.getDate() === today.getDate();
      
      const barber = this.loggedBarber();
      const isClosed = barber ? this.svc.isDiaClosedParaBarbeiro(dateStr, barber) : (dayOfWeek === 0 || dayOfWeek === 1);
      const temAgendamento = todosAgendamentos.some((a) => a.data === dateStr && (!barber || a.barbeiroId === barber));

      grid.push({
        date: dateStr,
        day: d,
        isToday,
        isClosed,
        temAgendamento,
      });
    }

    return grid;
  });

  // ── Computados: Linhas do Tempo Individuais ──────────────────
  readonly isDiaClosed = computed(() => {
    const data = this.filtroData();
    const barber = this.loggedBarber();
    if (!data || !barber) return false;
    return this.svc.isDiaClosedParaBarbeiro(data, barber);
  });

  readonly coserTimeline = computed((): TimelineSlot[] => {
    const data = this.filtroData();
    if (!data || this.isDiaClosed()) return [];

    const baseSlots = this.svc.obterBaseSlotsDoDia(data, 'coser');
    const agendamentos = this.svc.agendamentos().filter((a) => a.data === data && a.barbeiroId === 'coser');

    return baseSlots.map((horario) => {
      const agendamento = agendamentos.find((a) => a.horario === horario);
      if (agendamento) {
        return { horario, isClosed: false, agendamento };
      }

      // Verifica se é a continuação do combo de 1h do slot anterior
      const [h, m] = horario.split(':').map(Number);
      let prevM = m - 30;
      let prevH = h;
      if (prevM < 0) {
        prevH -= 1;
        prevM = 30;
      }
      const prevHorario = `${String(prevH).padStart(2, '0')}:${String(prevM).padStart(2, '0')}`;
      const prevAgendamento = agendamentos.find((a) => a.horario === prevHorario && a.servicoId === '3');
      
      if (prevAgendamento) {
        return { horario, isClosed: false, isContinuation: true, continuationOf: prevAgendamento };
      }

      return { horario, isClosed: false };
    });
  });

  readonly filippiTimeline = computed((): TimelineSlot[] => {
    const data = this.filtroData();
    if (!data || this.isDiaClosed()) return [];

    const baseSlots = this.svc.obterBaseSlotsDoDia(data, 'filippi');
    const agendamentos = this.svc.agendamentos().filter((a) => a.data === data && a.barbeiroId === 'filippi');

    return baseSlots.map((horario) => {
      const agendamento = agendamentos.find((a) => a.horario === horario);
      if (agendamento) {
        return { horario, isClosed: false, agendamento };
      }

      // Verifica se é a continuação do combo de 1h do slot anterior
      const [h, m] = horario.split(':').map(Number);
      let prevM = m - 30;
      let prevH = h;
      if (prevM < 0) {
        prevH -= 1;
        prevM = 30;
      }
      const prevHorario = `${String(prevH).padStart(2, '0')}:${String(prevM).padStart(2, '0')}`;
      const prevAgendamento = agendamentos.find((a) => a.horario === prevHorario && a.servicoId === '3');

      if (prevAgendamento) {
        return { horario, isClosed: false, isContinuation: true, continuationOf: prevAgendamento };
      }

      return { horario, isClosed: false };
    });
  });

  // ── Agendamentos Filtrados (Computed) ────────────────────────
  readonly agendamentosFiltrados = computed(() => {
    const data = this.filtroData();
    const barbeiro = this.barbeiroFiltro();
    let filtrados = this.svc.agendamentos();

    if (data) {
      filtrados = filtrados.filter((a) => a.data === data);
    }
    if (barbeiro !== 'all') {
      filtrados = filtrados.filter((a) => a.barbeiroId === barbeiro);
    }

    // Ordenação cronológica (Data e depois Horário)
    return [...filtrados].sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.horario.localeCompare(b.horario);
    });
  });

  // ── Estatísticas do Painel (Computed) ────────────────────────
  readonly totalAgendamentos = computed(() => this.agendamentosFiltrados().length);

  readonly faturamentoEstimado = computed(() => {
    return this.agendamentosFiltrados().reduce((total, a) => {
      let valorAgendamento = 0;
      if (a.precoCustomizado !== undefined && a.precoCustomizado !== null) {
        valorAgendamento = a.precoCustomizado;
      } else {
        const service = this.svc.obterServicoPorId(a.servicoId);
        if (service) {
          if (a.usouPlano) {
            if (a.servicoId === '3') {
              valorAgendamento = service.preco / 2; // Combo com metade do preço
            } else {
              valorAgendamento = 0; // Corte totalmente coberto pelo plano (R$ 0 adicionais)
            }
          } else {
            valorAgendamento = service.preco; // Preço normal avulso
          }
        }
      }
      let valorProdutos = 0;
      if (a.produtos && a.produtos.length > 0) {
        valorProdutos = a.produtos.reduce((sum, p) => sum + ((p.quantidade || 0) * (p.valor || 0)), 0);
      }
      return total + valorAgendamento + valorProdutos;
    }, 0);
  });

  readonly tempoTrabalhoEstimado = computed(() => {
    return this.agendamentosFiltrados().reduce((total, a) => {
      const service = this.svc.obterServicoPorId(a.servicoId);
      return total + (service?.duracaoMinutos || 0);
    }, 0);
  });

  // ── Efeito para Notificação Sonora ───────────────────────────
  constructor() {
    let previousCount = this.svc.agendamentos().length;
    
    effect(() => {
      const currentCount = this.svc.agendamentos().length;
      if (currentCount > previousCount && this.isAuthenticated()) {
        this.playNotificationChime();
      }
      previousCount = currentCount;
    });

    // Sincroniza a configuração de expedientes em tempo real
    effect(() => {
      const barber = this.loggedBarber();
      if (barber) {
        const globalConfig = this.svc.configs()[barber];
        if (globalConfig) {
          const clone = JSON.parse(JSON.stringify(globalConfig)) as BarbeiroConfig;
          if (!this.isSavingConfig()) {
            this.activeConfig.set(clone);
          }
        }
      }
    });

    // Recupera a sessão do barbeiro reativamente se ele atualizar a página
    effect(() => {
      const profile = this.authService.currentUser();
      const isInit = this.authService.isInitializing();
      
      if (!isInit && profile && profile.role === 'barber') {
        if (!this.isAuthenticated()) {
          console.log('[AdminComponent] Sessão de barbeiro ativa recuperada para:', profile.displayName);
          this.loggedBarber.set(profile.barberId || null);
          this.barbeiroFiltro.set(profile.barberId || 'all');
          this.isAuthenticated.set(true);
          this.loadBarberConfig();
          this.startListeningClients();
        }
      }
    });
  }

  // ── Autenticação ─────────────────────────────────────────────
  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();
    this.loginError.set(null);

    try {
      await this.authService.login(email, password);
      const profile = this.authService.currentUser();
      
      if (profile && profile.role === 'barber' && (profile.barberId === 'coser' || profile.barberId === 'filippi')) {
        this.loggedBarber.set(profile.barberId);
        this.barbeiroFiltro.set(profile.barberId);
        this.isAuthenticated.set(true);
        this.loginForm.reset();
        this.loadBarberConfig();
        this.startListeningClients();
      } else {
        await this.authService.logout();
        this.loggedBarber.set(null);
        this.isAuthenticated.set(false);
        this.loginError.set('Acesso negado: esta conta não possui permissões de barbeiro.');
      }
    } catch (error: any) {
      console.error('Erro ao efetuar login do barbeiro:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        this.loginError.set('E-mail ou senha incorretos.');
      } else {
        this.loginError.set('Erro ao conectar com o servidor de autenticação.');
      }
    }
  }

  async logout(): Promise<void> {
    this.stopListeningClients();
    await this.authService.logout();
    this.isAuthenticated.set(false);
    this.loggedBarber.set(null);
    this.activeConfig.set(null);
    this.filtroData.set('');
    this.activeAdminTab.set('agenda');
  }

  loadBarberConfig(): void {
    const barber = this.loggedBarber();
    if (barber) {
      const globalConfig = this.svc.configs()[barber];
      if (globalConfig) {
        const clone = JSON.parse(JSON.stringify(globalConfig)) as BarbeiroConfig;
        this.activeConfig.set(clone);
      }
    }
  }

  async salvarExpediente(): Promise<void> {
    console.log('[AdminComponent] Iniciando salvamento de expediente...');
    const config = this.activeConfig();
    if (!config) {
      console.warn('[AdminComponent] activeConfig() está nulo! Não há dados para salvar.');
      alert('Erro: Nenhuma configuração de horários carregada para salvar.');
      return;
    }

    console.log('[AdminComponent] Dados a serem salvos:', JSON.stringify(config));
    this.isSavingConfig.set(true);
    this.configSuccess.set(null);

    try {
      console.log('[AdminComponent] Chamando serviço para salvar...');
      await this.svc.salvarBarbeiroConfig(config);
      console.log('[AdminComponent] Retorno do serviço concluído!');
      this.configSuccess.set('Horários de expediente salvos com sucesso!');
      setTimeout(() => this.configSuccess.set(null), 4000);
      alert('Horários salvos com sucesso no Firestore!');
    } catch (err: any) {
      console.error('[AdminComponent] Erro capturado no componente:', err);
      alert('Erro ao salvar no banco: ' + (err?.message || err));
    } finally {
      this.isSavingConfig.set(false);
      console.log('[AdminComponent] Finalizada a tentativa de salvamento.');
    }
  }

  adicionarBloqueio(dia: DiaConfig): void {
    if (!dia.bloqueios) {
      dia.bloqueios = [];
    }
    dia.bloqueios.push({ inicio: '12:00', fim: '13:00' });
    
    // Força a atualização do sinal para propagar as mudanças na view
    const current = this.activeConfig();
    if (current) {
      this.activeConfig.set({ ...current });
    }
  }

  removerBloqueio(dia: DiaConfig, index: number): void {
    if (dia.bloqueios) {
      dia.bloqueios.splice(index, 1);
      
      // Força a atualização do sinal para propagar as mudanças na view
      const current = this.activeConfig();
      if (current) {
        this.activeConfig.set({ ...current });
      }
    }
  }


  // ── Ações do Painel ──────────────────────────────────────────
  cancelarAgendamento(id: string, clienteNome: string): void {
    const confirmacao = confirm(
      `Deseja realmente cancelar o agendamento de ${clienteNome}? Esta ação não pode ser desfeita.`
    );
    
    if (confirmacao) {
      this.svc.removerAgendamento(id);
    }
  }

  abrirModalAgendamentoEspecial(): void {
    this.specialBookingNome.set('');
    this.specialBookingCategoria.set('idoso');
    this.specialBookingServicoId.set('1');
    this.specialBookingPreco.set(35); // Preço padrão para serviço '1' (Corte)
    
    const logged = this.loggedBarber();
    this.specialBookingBarbeiroId.set(logged && (logged === 'coser' || logged === 'filippi') ? logged : 'coser');
    
    this.specialBookingData.set(this.filtroData());
    this.specialBookingHorario.set('');
    
    this.showSpecialBookingModal.set(true);
  }

  onServicoChange(servicoId: string): void {
    this.specialBookingServicoId.set(servicoId);
    const s = this.svc.obterServicoPorId(servicoId);
    if (s) {
      this.specialBookingPreco.set(s.preco);
    }
  }

  async salvarAgendamentoEspecial(): Promise<void> {
    if (this.salvandoEspecial()) return;
    this.salvandoEspecial.set(true);

    try {
      const nome = this.specialBookingNome().trim();
      const categoria = this.specialBookingCategoria();
      const servicoId = this.specialBookingServicoId();
      const barbeiroId = this.specialBookingBarbeiroId();
      const data = this.specialBookingData();
      const horario = this.specialBookingHorario();
      const preco = this.specialBookingPreco();

      if (!nome) {
        alert('Por favor, informe o nome do cliente.');
        return;
      }
      if (!data) {
        alert('Por favor, selecione uma data.');
        return;
      }
      if (!horario) {
        alert('Por favor, selecione um horário disponível.');
        return;
      }
      if (preco === null || preco === undefined || preco < 0) {
        alert('Por favor, insira um preço válido.');
        return;
      }

      await this.svc.salvarAgendamento({
        clienteNome: nome,
        servicoId,
        barbeiroId,
        data,
        horario,
        categoriaEspecial: categoria,
        usouPlano: false,
        precoCustomizado: preco,
      });
      alert('Agendamento especial cadastrado com sucesso!');
      this.showSpecialBookingModal.set(false);
    } catch (err: any) {
      console.error('Erro ao salvar agendamento especial:', err);
      alert('Erro ao salvar agendamento especial: ' + (err?.message || err));
    } finally {
      this.salvandoEspecial.set(false);
    }
  }

  readonly produtosSendoEditados = signal<Record<string, ProdutoAdicional[]>>({});
  readonly precosSendoEditados = signal<Record<string, number | null>>({});

  obterProdutosEditando(agendamentoId: string, agendamentoRef: Agendamento): ProdutoAdicional[] {
    const editando = this.produtosSendoEditados()[agendamentoId];
    if (editando) return editando;
    return agendamentoRef.produtos && agendamentoRef.produtos.length > 0
      ? agendamentoRef.produtos
      : [{ nome: '', quantidade: 1, valor: 0 }];
  }

  obterPrecoEditando(agendamentoId: string, agendamentoRef: Agendamento): string {
    const preco = this.precosSendoEditados()[agendamentoId];
    const valor = preco !== undefined && preco !== null ? preco : (agendamentoRef.precoCustomizado ?? 0);
    return this.formatarMoedaExibicao(valor);
  }

  aoDigitarPrecoServico(event: Event, agendamentoId: string): void {
    const input = event.target as HTMLInputElement;
    const originalValue = input.value;
    const selectionStart = input.selectionStart;
    
    let apenasDigitos = originalValue.replace(/\D/g, '');
    const centavos = parseInt(apenasDigitos, 10) || 0;
    const valorFinal = centavos / 100;
    
    this.precosSendoEditados.update(prev => ({
      ...prev,
      [agendamentoId]: valorFinal
    }));
    
    const formatted = this.formatarMoedaExibicao(valorFinal);
    input.value = formatted;
    
    if (selectionStart !== null) {
      if (selectionStart === originalValue.length) {
        input.setSelectionRange(formatted.length, formatted.length);
      } else {
        const offsetFromEnd = originalValue.length - selectionStart;
        const newPosition = Math.max(0, formatted.length - offsetFromEnd);
        input.setSelectionRange(newPosition, newPosition);
      }
    }
  }

  adicionarLinhaProduto(agendamentoId: string): void {
    const current = this.produtosSendoEditados()[agendamentoId];
    if (current) {
      this.produtosSendoEditados.update(prev => ({
        ...prev,
        [agendamentoId]: [...current, { nome: '', quantidade: 1, valor: 0 }]
      }));
    }
  }

  removerLinhaProduto(agendamentoId: string, idx: number): void {
    const current = this.produtosSendoEditados()[agendamentoId];
    if (current) {
      const copy = [...current];
      copy.splice(idx, 1);
      
      if (copy.length === 0) {
        copy.push({ nome: '', quantidade: 1, valor: 0 });
      }
      
      this.produtosSendoEditados.update(prev => ({
        ...prev,
        [agendamentoId]: copy
      }));
    }
  }

  async salvarProdutosDinamico(agendamentoId: string): Promise<void> {
    const lista = this.produtosSendoEditados()[agendamentoId];
    const produtos = lista || [];

    const filtrados = produtos
      .map(p => ({
        nome: p.nome.trim(),
        quantidade: Math.max(1, parseInt(p.quantidade as any, 10) || 1),
        valor: Math.max(0, parseFloat(p.valor as any) || 0)
      }))
      .filter(p => p.nome.length > 0);

    const precoCustomizado = this.precosSendoEditados()[agendamentoId] ?? null;

    try {
      await this.svc.salvarDetalhesAgendamento(agendamentoId, filtrados, precoCustomizado);
      alert('Dados salvos com sucesso!');
      
      this.produtosSendoEditados.update(prev => ({
        ...prev,
        [agendamentoId]: filtrados.length > 0 ? filtrados : [{ nome: '', quantidade: 1, valor: 0 }]
      }));
    } catch (err: any) {
      console.error('Erro ao salvar produtos no agendamento:', err);
    }
  }

  formatarMoedaExibicao(valor: any): string {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  aoDigitarValor(event: Event, prod: ProdutoAdicional): void {
    const input = event.target as HTMLInputElement;
    const originalValue = input.value;
    const selectionStart = input.selectionStart;
    
    let apenasDigitos = originalValue.replace(/\D/g, '');
    const centavos = parseInt(apenasDigitos, 10) || 0;
    const valorFinal = centavos / 100;
    prod.valor = valorFinal;
    
    const formatted = this.formatarMoedaExibicao(valorFinal);
    input.value = formatted;
    
    if (selectionStart !== null) {
      if (selectionStart === originalValue.length) {
        input.setSelectionRange(formatted.length, formatted.length);
      } else {
        const offsetFromEnd = originalValue.length - selectionStart;
        const newPosition = Math.max(0, formatted.length - offsetFromEnd);
        input.setSelectionRange(newPosition, newPosition);
      }
    }
  }

  // ── Auxiliares ───────────────────────────────────────────────
  formatarPreco(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(data: string): string {
    const [ano, mes, dia] = data.split('-').map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
  }

  obterServicoNome(id: string): string {
    return this.svc.obterServicoPorId(id)?.nome || 'Serviço Desconhecido';
  }

  obterBarbeiroNome(id: string): string {
    if (id === 'coser') return 'Davi Coser';
    if (id === 'filippi') return 'Filippi';
    return id;
  }

  // ── Sintetizador de Som Nativo (Web Audio API) ────────────────
  private playNotificationChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      // Nota Ré5 (587.33Hz) seguida de Lá5 (880Hz)
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('Bloqueado pela política do navegador. Aguardando interação do usuário.', e);
    }
  }

  // ── Controle do Listener de Clientes e Planos ───────────────
  startListeningClients(): void {
    if (this.unsubscribeUsers) return;

    console.log('[AdminComponent] Iniciando escuta da coleção de clientes...');
    const usersCol = collection(db, 'users');
    this.unsubscribeUsers = onSnapshot(usersCol, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        const user = docSnap.data() as UserProfile;
        if (user.role !== 'barber') {
          list.push(user);
        }
      });
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      this.clients.set(list);
    }, (err) => {
      console.error('[AdminComponent] Erro na escuta de clientes:', err);
    });
  }

  stopListeningClients(): void {
    if (this.unsubscribeUsers) {
      this.unsubscribeUsers();
      this.unsubscribeUsers = null;
      console.log('[AdminComponent] Escuta de clientes encerrada.');
    }
    this.clients.set([]);
  }

  async mudarPlanoCliente(uid: string, plan: 'silver' | 'gold' | 'vip' | 'none'): Promise<void> {
    const confirmar = window.confirm(`Deseja realmente alterar o plano deste cliente para ${plan.toUpperCase()}?`);
    if (!confirmar) return;

    try {
      const cuts = plan === 'silver' ? 2 : null;
      await this.authService.atualizarPlanoUsuario(uid, plan, cuts);
      alert('Plano atualizado com sucesso para este cliente!');
    } catch (err: any) {
      console.error('[AdminComponent] Erro ao alterar plano do cliente:', err);
      alert('Erro ao alterar plano: ' + (err?.message || err));
    }
  }

  async ajustarCortesSilver(uid: string, cutsStr: string): Promise<void> {
    const cuts = parseInt(cutsStr, 10);
    if (isNaN(cuts) || cuts < 0) {
      alert('Por favor, insira um número válido de cortes.');
      return;
    }

    try {
      await this.authService.atualizarPlanoUsuario(uid, 'silver', cuts);
      alert('Cortes restantes do cliente Silver ajustados com sucesso!');
    } catch (err: any) {
      console.error('[AdminComponent] Erro ao ajustar cortes do cliente:', err);
      alert('Erro ao ajustar cortes: ' + (err?.message || err));
    }
  }

  ngOnDestroy(): void {
    this.stopListeningClients();
  }
}
