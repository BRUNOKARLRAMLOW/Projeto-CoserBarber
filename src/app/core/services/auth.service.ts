import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { app, db } from './agenda.service';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  cpf?: string;
  role?: 'barber' | 'client';
  barberId?: 'coser' | 'filippi' | null;
  plan?: 'silver' | 'gold' | 'vip' | 'none';
  planHaircutsLeft?: number | null;
  planLastResetDate?: string | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = getAuth(app);

  public readonly currentUser = signal<UserProfile | null>(null);
  public readonly isInitializing = signal<boolean>(true);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      setPersistence(this.auth, browserLocalPersistence)
        .catch(err => console.error('[AuthService] Erro ao configurar persistência local:', err));

      onAuthStateChanged(this.auth, async (firebaseUser) => {
        if (firebaseUser) {
          // Verificar expiração de 7 dias (7 * 24 * 60 * 60 * 1000 = 604800000 ms)
          const SeteDiasMs = 7 * 24 * 60 * 60 * 1000;
          const agora = new Date().getTime();
          const timestampStr = localStorage.getItem('auth_login_timestamp');

          if (timestampStr) {
            const timestamp = parseInt(timestampStr, 10);
            if (isNaN(timestamp) || agora - timestamp > SeteDiasMs) {
              console.log('[AuthService] Sessão expirou (mais de 7 dias ou timestamp inválido). Efetuando logout automático.');
              localStorage.removeItem('auth_login_timestamp');
              await this.logout();
              this.isInitializing.set(false);
              return;
            } else {
              // Se a sessão ainda é válida, renovamos por mais 7 dias a partir de hoje (sliding expiration)
              localStorage.setItem('auth_login_timestamp', agora.toString());
            }
          } else {
            // Se o usuário está autenticado mas não há timestamp gravado (ex: transição de versão),
            // gravamos o timestamp atual para dar 7 dias a partir de agora.
            localStorage.setItem('auth_login_timestamp', agora.toString());
          }

          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              let data = userDoc.data() as UserProfile;
              if (!data.role) {
                data.role = 'client';
              }
              if (data.barberId === undefined) {
                data.barberId = null;
              }
              if (!data.plan) {
                data.plan = 'none';
              }
              // Verificar e aplicar reset do plano Silver se necessário
              data = await this.verificarEResetarCortesSilver(data);
              this.currentUser.set(data);
            } else {
              const defaultProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || 'Cliente',
                role: 'client',
                barberId: null,
                plan: 'none',
                createdAt: new Date().toISOString()
              };
              this.currentUser.set(defaultProfile);
            }
          } catch (err) {
            console.error('Error fetching user profile:', err);
            this.currentUser.set({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Cliente',
              role: 'client',
              barberId: null,
              plan: 'none',
              createdAt: new Date().toISOString()
            });
          }
        } else {
          this.currentUser.set(null);
        }
        this.isInitializing.set(false);
      });
    } else {
      this.isInitializing.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('auth_login_timestamp', new Date().getTime().toString());
    }
  }

  async signup(email: string, password: string, name: string, phone: string, cpf?: string): Promise<void> {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    const firebaseUser = userCredential.user;

    await updateProfile(firebaseUser, { displayName: name });

    const profile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || email,
      displayName: name,
      phoneNumber: phone,
      role: 'client',
      barberId: null,
      plan: 'none',
      createdAt: new Date().toISOString()
    };

    if (cpf) {
      profile.cpf = cpf;
    }

    await setDoc(doc(db, 'users', firebaseUser.uid), profile);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('auth_login_timestamp', new Date().getTime().toString());
    }
    this.currentUser.set(profile);
  }

  async logout(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_login_timestamp');
    }
    await signOut(this.auth);
    this.currentUser.set(null);
  }

  /**
   * Verifica se o usuário Silver precisa resetar a cota de cortes (todo dia 15 de cada mês).
   * Lógica não-cumulativa.
   */
  private async verificarEResetarCortesSilver(profile: UserProfile): Promise<UserProfile> {
    if (profile.plan !== 'silver') return profile;

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();

    // Data limite de reset do mês corrente: dia 15 às 00:00:00
    const dataResetCorrente = new Date(ano, mes, 15, 0, 0, 0, 0);

    // Se hoje for ANTES do dia 15 do mês corrente, a data de reset relevante é o dia 15 do mês ANTERIOR.
    let dataResetAlvo = dataResetCorrente;
    if (hoje.getTime() < dataResetCorrente.getTime()) {
      dataResetAlvo = new Date(ano, mes - 1, 15, 0, 0, 0, 0);
    }

    const formatDataReset = dataResetAlvo.toISOString().split('T')[0];

    // Se o último reset foi feito antes da data alvo, reseta para 2 cortes!
    if (!profile.planLastResetDate || profile.planLastResetDate < formatDataReset) {
      console.log(`[AuthService] Resetando cortes do plano Silver para o cliente ${profile.displayName}.`);
      const profileAtualizado: UserProfile = {
        ...profile,
        planHaircutsLeft: 2,
        planLastResetDate: formatDataReset
      };
      await setDoc(doc(db, 'users', profile.uid), profileAtualizado);
      return profileAtualizado;
    }

    return profile;
  }

  /**
   * Atualiza o plano de um usuário no Firestore e em memória caso seja o usuário logado
   */
  async atualizarPlanoUsuario(uid: string, plan: 'silver' | 'gold' | 'vip' | 'none', planHaircutsLeft?: number | null): Promise<void> {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) throw new Error('Usuário não encontrado.');

    const data = userDoc.data() as UserProfile;
    
    // Mantém a data de reset ou define a de agora caso assine Silver
    let planLastResetDate = data.planLastResetDate || null;
    if (plan === 'silver' && !planLastResetDate) {
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = hoje.getMonth();
      const resetThisMonth = new Date(ano, mes, 15, 0, 0, 0, 0);
      let targetReset = resetThisMonth;
      if (hoje.getTime() < resetThisMonth.getTime()) {
        targetReset = new Date(ano, mes - 1, 15, 0, 0, 0, 0);
      }
      planLastResetDate = targetReset.toISOString().split('T')[0];
    } else if (plan !== 'silver') {
      planLastResetDate = null;
    }

    const profileAtualizado: UserProfile = {
      ...data,
      plan,
      planHaircutsLeft: plan === 'silver' ? (planHaircutsLeft !== undefined && planHaircutsLeft !== null ? planHaircutsLeft : 2) : null,
      planLastResetDate
    };

    await setDoc(userDocRef, profileAtualizado);

    // Se for o próprio usuário conectado, atualiza o sinal reativo em tempo real
    const current = this.currentUser();
    if (current && current.uid === uid) {
      this.currentUser.set(profileAtualizado);
    }
  }
}
