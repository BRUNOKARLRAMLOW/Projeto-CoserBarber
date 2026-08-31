import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import type { Servico, Agendamento, DiaConfig, BarbeiroConfig, ProdutoAdicional } from '../models/agenda.model';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

export function gerarSlotsDeAte(inicio: string, fim: string): string[] {
  const slots: string[] = [];
  const [startH, startM] = inicio.split(':').map(Number);
  const [endH, endM] = fim.split(':').map(Number);

  let current = startH + (startM === 30 ? 0.5 : 0);
  const end = endH + (endM === 30 ? 0.5 : 0);

  while (current < end) {
    const h = Math.floor(current);
    const m = (current % 1) === 0.5 ? '30' : '00';
    slots.push(`${String(h).padStart(2, '0')}:${m}`);
    current += 0.5;
  }
  return slots;
}

const defaultConfigs: Record<'coser' | 'filippi', BarbeiroConfig> = {
  coser: {
    barbeiroId: 'coser',
    nome: 'Davi Coser',
    dias: {
      0: { diaNome: 'Domingo', ativo: false, inicio: '09:00', fim: '18:00' },
      1: { diaNome: 'Segunda-feira', ativo: false, inicio: '09:00', fim: '18:00' },
      2: { diaNome: 'Terça-feira', ativo: true, inicio: '09:00', fim: '20:00' },
      3: { diaNome: 'Quarta-feira', ativo: true, inicio: '09:00', fim: '20:00' },
      4: { diaNome: 'Quinta-feira', ativo: true, inicio: '09:00', fim: '20:00' },
      5: { diaNome: 'Sexta-feira', ativo: true, inicio: '09:00', fim: '20:00' },
      6: { diaNome: 'Sábado', ativo: true, inicio: '08:00', fim: '16:00' },
    }
  },
  filippi: {
    barbeiroId: 'filippi',
    nome: 'Filippi',
    dias: {
      0: { diaNome: 'Domingo', ativo: false, inicio: '09:00', fim: '18:00' },
      1: { diaNome: 'Segunda-feira', ativo: false, inicio: '09:00', fim: '18:00' },
      2: { diaNome: 'Terça-feira', ativo: true, inicio: '09:00', fim: '13:30' },
      3: { diaNome: 'Quarta-feira', ativo: true, inicio: '09:00', fim: '13:30' },
      4: { diaNome: 'Quinta-feira', ativo: true, inicio: '09:00', fim: '13:30' },
      5: { diaNome: 'Sexta-feira', ativo: true, inicio: '09:00', fim: '13:30' },
      6: { diaNome: 'Sábado', ativo: true, inicio: '08:00', fim: '16:00' },
    }
  }
};

/** Gera slots de 30min entre start (inclusivo) e end (exclusivo) */
function gerarSlots(startH: number, endH: number): string[] {
  const slots: string[] = [];
  let current = startH;
  while (current < endH) {
    const h = Math.floor(current);
    const m = (current % 1) === 0.5 ? '30' : '00';
    slots.push(`${String(h).padStart(2, '0')}:${m}`);
    current += 0.5;
  }
  return slots;
}

export function obterProximoSlot(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  let nextH = h;
  let nextM = m + 30;
  if (nextM >= 60) {
    nextH += 1;
    nextM -= 60;
  }
  return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
}



import { environment } from '../../../environments/environment';

export const app = initializeApp(environment.firebase);
export const db = environment.firestoreDatabaseId && environment.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, environment.firestoreDatabaseId)
  : getFirestore(app);

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly platformId = inject(PLATFORM_ID);

  // ── Estado interno ──────────────────────────────────────────
  private readonly agendamentosCollection = collection(db, 'agendamentos');
  private readonly configCollection = collection(db, 'config_horarios');

  readonly configs = signal<Record<'coser' | 'filippi', BarbeiroConfig>>(defaultConfigs);

  private readonly servicosSubject = new BehaviorSubject<Servico[]>([
    {
      id: '1',
      nome: 'Corte',
      descricao: 'Corte de cabelo masculino personalizado, independente do tipo.',
      preco: 35,
      duracaoMinutos: 30,
    },
    {
      id: '2',
      nome: 'Barba',
      descricao: 'Barba completa com toalha quente, óleo e acabamento com navalha.',
      preco: 30,
      duracaoMinutos: 30,
    },
    {
      id: '3',
      nome: 'Corte + Barba',
      descricao: 'Combo completo de corte e barba com desconto especial.',
      preco: 60,
      duracaoMinutos: 60,
    },
  ]);

  private readonly agendamentosSubject = new BehaviorSubject<Agendamento[]>([]);
  readonly agendamentos = signal<Agendamento[]>([]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        console.log('Ambiente local (localhost) detectado. Ignorando Firebase App Check para evitar bloqueios de reCAPTCHA.');
      } else if (environment.recaptchaSiteKey && !environment.recaptchaSiteKey.includes('YOUR_')) {
        try {
          initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(environment.recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true
          });
          console.log('Firebase App Check inicializado com sucesso usando reCAPTCHA v3!');
        } catch (err) {
          console.warn('Erro ao inicializar o Firebase App Check:', err);
        }
      }
    }

    // Escuta em tempo real as mudanças no Firestore
    onSnapshot(this.agendamentosCollection, (snapshot) => {
      const lista: Agendamento[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        lista.push({
          id: docSnap.id,
          clienteNome: data['clienteNome'],
          clienteUid: data['clienteUid'] || null,
          clienteTelefone: data['clienteTelefone'] || null,
          servicoId: data['servicoId'],
          barbeiroId: data['barbeiroId'],
          data: data['data'],
          horario: data['horario'],
          usouPlano: data['usouPlano'] || false,
          categoriaEspecial: data['categoriaEspecial'] || null,
          precoCustomizado: data['precoCustomizado'] !== undefined ? data['precoCustomizado'] : null,
          produtos: data['produtos'] || []
        } as Agendamento);
      });
      this.agendamentosSubject.next(lista);
      this.agendamentos.set(lista);
    });

    // Escuta em tempo real as configurações de expediente
    onSnapshot(this.configCollection, (snapshot) => {
      const currentConfigs = { ...this.configs() };
      let updated = false;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as BarbeiroConfig;
        if (docSnap.id === 'coser' || docSnap.id === 'filippi') {
          currentConfigs[docSnap.id] = data;
          updated = true;
        }
      });
      if (updated) {
        this.configs.set(currentConfigs);
      }
    });
  }

  // ── Observables públicos ────────────────────────────────────
  readonly servicos$: Observable<Servico[]> = this.servicosSubject.asObservable();
  readonly agendamentos$: Observable<Agendamento[]> = this.agendamentosSubject.asObservable();

  // ── Consultas ───────────────────────────────────────────────
  obterServicos(): Servico[] {
    return this.servicosSubject.getValue();
  }

  obterServicoPorId(id: string): Servico | undefined {
    return this.servicosSubject.getValue().find((s) => s.id === id);
  }

  /** true se o dia da semana da data está fechado (domingo ou segunda) */
  isDiaClosed(data: string): boolean {
    const [ano, mes, dia] = data.split('-').map(Number);
    const day = new Date(ano, mes - 1, dia).getDay();
    return day === 0 || day === 1;
  }

  isDiaClosedParaBarbeiro(data: string, barbeiroId: 'coser' | 'filippi'): boolean {
    const [ano, mes, dia] = data.split('-').map(Number);
    const dayIndex = new Date(ano, mes - 1, dia).getDay();
    const config = this.configs()[barbeiroId];
    if (!config || !config.dias) return true;
    return !config.dias[dayIndex]?.ativo;
  }

  obterBaseSlotsDoDia(data: string, barbeiroId: 'coser' | 'filippi'): string[] {
    const [ano, mes, dia] = data.split('-').map(Number);
    const dayIndex = new Date(ano, mes - 1, dia).getDay();
    const config = this.configs()[barbeiroId];
    if (!config || !config.dias) return [];
    
    const diaConfig = config.dias[dayIndex];
    if (!diaConfig || !diaConfig.ativo) {
      return [];
    }
    
    const baseSlots = gerarSlotsDeAte(diaConfig.inicio, diaConfig.fim);
    if (!diaConfig.bloqueios || diaConfig.bloqueios.length === 0) {
      return baseSlots;
    }

    return baseSlots.filter(slot => {
      const slotStart = slot;
      const slotEnd = obterProximoSlot(slot);
      
      const estaBloqueado = diaConfig.bloqueios!.some(bloqueio => {
        if (!bloqueio.inicio || !bloqueio.fim) return false;
        return slotStart < bloqueio.fim && slotEnd > bloqueio.inicio;
      });
      
      return !estaBloqueado;
    });
  }


  async salvarBarbeiroConfig(config: BarbeiroConfig): Promise<void> {
    console.log('[AgendaService] Iniciando salvarBarbeiroConfig para:', config.barbeiroId);
    try {
      const docRef = doc(db, 'config_horarios', config.barbeiroId);
      console.log('[AgendaService] Referência criada:', docRef.path);
      console.log('[AgendaService] Executando setDoc no Firestore...');
      await setDoc(docRef, config);
      console.log('[AgendaService] setDoc concluído com sucesso no Firestore!');
    } catch (e: any) {
      console.error("[AgendaService] Erro ao salvar expediente no Firestore:", e);
      window.alert("[Serviço] Erro ao salvar expediente: " + (e.message || e));
      throw e;
    }
  }

  /** Retorna os slots do dia ainda não reservados para o barbeiro e serviço específicos */
  obterHorariosDisponiveis(data: string, barbeiroId: 'coser' | 'filippi', servicoId?: string): string[] {
    const base = this.obterBaseSlotsDoDia(data, barbeiroId);

    // Mapeia horários ocupados por esse barbeiro nessa data
    const ocupados: string[] = [];
    this.agendamentos()
      .filter((a) => a.data === data && a.barbeiroId === barbeiroId)
      .forEach((a) => {
        ocupados.push(a.horario);
        // Se for o combo Corte + Barba (ID 3), ele também ocupa o próximo slot de 30min!
        if (a.servicoId === '3') {
          ocupados.push(obterProximoSlot(a.horario));
        }
      });

    // Filtra os slots que estão de fato livres
    const livres = base.filter((h: string) => !ocupados.includes(h));

    // Se o serviço selecionado for o combo de 60 minutos (id '3'),
    // agrupamos os slots consecutivos de 30min em blocos de 1h não-sobrepostos.
    if (servicoId === '3') {
      const result: string[] = [];
      let i = 0;
      while (i < livres.length) {
        const current = livres[i];
        const next = obterProximoSlot(current);
        if (livres.includes(next)) {
          result.push(current);
          const nextIndex = livres.indexOf(next);
          if (nextIndex !== -1) {
            i = nextIndex + 1;
            continue;
          }
        }
        i++;
      }
      return result;
    }

    return livres;
  }

  async verificarDisponibilidade(
    data: string,
    barbeiroId: 'coser' | 'filippi',
    horario: string,
    servicoId: string
  ): Promise<boolean> {
    try {
      // 1. Consulta em tempo real para obter os agendamentos já salvos da data e barbeiro
      const q = query(
        this.agendamentosCollection,
        where('data', '==', data),
        where('barbeiroId', '==', barbeiroId)
      );
      const querySnapshot = await getDocs(q);
      const agendamentosExistentes: Agendamento[] = [];
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        agendamentosExistentes.push({
          id: docSnap.id,
          horario: d['horario'],
          servicoId: d['servicoId'],
          data: d['data'],
          barbeiroId: d['barbeiroId'],
        } as Agendamento);
      });

      // 2. Calcula todos os slots ocupados
      const ocupados: string[] = [];
      agendamentosExistentes.forEach((a) => {
        ocupados.push(a.horario);
        if (a.servicoId === '3') {
          ocupados.push(obterProximoSlot(a.horario));
        }
      });

      // 3. Determina quais slots o novo agendamento requer
      const slotsNecessarios: string[] = [horario];
      if (servicoId === '3') {
        slotsNecessarios.push(obterProximoSlot(horario));
      }

      // 4. Se algum slot necessário já está ocupado, não está disponível
      const algumOcupado = slotsNecessarios.some((slot) => ocupados.includes(slot));
      if (algumOcupado) {
        return false;
      }

      // 5. Verifica se está na base de funcionamento e não está bloqueado administrativamente
      const baseSlots = this.obterBaseSlotsDoDia(data, barbeiroId);
      const algumBloqueado = slotsNecessarios.some((slot) => !baseSlots.includes(slot));
      if (algumBloqueado) {
        return false;
      }

      return true;
    } catch (err) {
      console.error('[AgendaService] Erro ao verificar disponibilidade no Firestore:', err);
      return true;
    }
  }

  // ── Registrar Agendamento ───────────────────────────────────
  async salvarAgendamento(agendamento: Omit<Agendamento, 'id'>): Promise<void> {
    try {
      await addDoc(this.agendamentosCollection, agendamento);
    } catch (e: any) {
      console.error("Erro ao salvar agendamento no Firestore:", e);
      window.alert("Erro de Conexão Firebase: " + (e.message || e));
      throw e;
    }
  }

  async atualizarProdutosAgendamento(id: string, produtos: ProdutoAdicional[]): Promise<void> {
    try {
      const docRef = doc(db, 'agendamentos', id);
      await setDoc(docRef, { produtos }, { merge: true });
    } catch (e: any) {
      console.error("Erro ao atualizar produtos do agendamento:", e);
      window.alert("Erro ao salvar produtos: " + (e.message || e));
      throw e;
    }
  }

  async salvarDetalhesAgendamento(id: string, produtos: ProdutoAdicional[], precoCustomizado: number | null): Promise<void> {
    try {
      const docRef = doc(db, 'agendamentos', id);
      await setDoc(docRef, { produtos, precoCustomizado }, { merge: true });
    } catch (e: any) {
      console.error("Erro ao salvar detalhes do agendamento:", e);
      window.alert("Erro ao salvar: " + (e.message || e));
      throw e;
    }
  }

  async removerAgendamento(id: string): Promise<void> {
    try {
      const agendamentoDocRef = doc(db, 'agendamentos', id);
      const agendamentoSnap = await getDoc(agendamentoDocRef);

      if (agendamentoSnap.exists()) {
        const agendamentoData = agendamentoSnap.data();
        const clienteUid = agendamentoData['clienteUid'];
        const usouPlano = agendamentoData['usouPlano'];

        // Se usou plano e temos o UID do cliente, vamos tentar devolver o crédito
        if (usouPlano && clienteUid) {
          try {
            const userDocRef = doc(db, 'users', clienteUid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              if (userData['plan'] === 'silver') {
                const currentLeft = userData['planHaircutsLeft'] ?? 0;
                const novoSaldo = Math.min(2, currentLeft + 1);
                console.log(`[AgendaService] Devolvendo 1 crédito do plano Silver para o cliente ${userData['displayName']}. Novo saldo: ${novoSaldo}`);
                await setDoc(userDocRef, {
                  ...userData,
                  planHaircutsLeft: novoSaldo
                });
              }
            }
          } catch (err) {
            console.error('[AgendaService] Erro ao estornar crédito do plano Silver:', err);
          }
        }
      }

      await deleteDoc(agendamentoDocRef);
    } catch (e) {
      console.error("Erro ao remover agendamento do Firestore:", e);
    }
  }
}
