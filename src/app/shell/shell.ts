import { Component, ChangeDetectionStrategy, signal, inject, ElementRef, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@core/services/agenda.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  readonly menuAberto = signal(false);
  readonly menuContaAberto = signal(false);
  readonly currentYear = new Date().getFullYear();

  // Estados de Personalização de Perfil
  readonly showEditProfile = signal(false);
  readonly editNome = signal('');
  readonly editPhone = signal('');
  readonly isSavingProfile = signal(false);

  toggleMenu(): void {
    this.menuAberto.update((v) => !v);
  }

  fecharMenu(): void {
    this.menuAberto.set(false);
  }

  toggleMenuConta(): void {
    this.menuContaAberto.update((v) => !v);
  }

  fecharMenuConta(): void {
    this.menuContaAberto.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.menuContaAberto.set(false);
    }
  }

  abrirEditProfile(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.editNome.set(user.displayName);
      this.editPhone.set(user.phoneNumber || '');
      this.showEditProfile.set(true);
      this.menuContaAberto.set(false);
      this.fecharMenu();
    }
  }

  async salvarPerfil(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;

    const nome = this.editNome().trim();
    const phone = this.editPhone().trim();

    if (nome.length < 2) {
      alert('Por favor, insira um nome válido (mínimo de 2 caracteres).');
      return;
    }

    this.isSavingProfile.set(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const updatedProfile = {
        ...user,
        displayName: nome,
        phoneNumber: phone
      };
      await setDoc(userDocRef, updatedProfile);
      this.authService.currentUser.set(updatedProfile);
      
      alert('Perfil atualizado com sucesso!');
      this.showEditProfile.set(false);
    } catch (err: any) {
      console.error('Erro ao salvar perfil:', err);
      alert('Erro ao salvar perfil: ' + (err?.message || err));
    } finally {
      this.isSavingProfile.set(false);
    }
  }

  logout(): void {
    this.authService.logout();
    this.menuContaAberto.set(false);
    this.router.navigate(['/home']);
    this.fecharMenu();
  }
}
