import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Estados principais
  isSignUp = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  errorMessage = signal('');
  isLoading = signal(false);

  // Campos do formulário
  name = '';
  email = '';
  phoneNumber = '';
  password = '';
  confirmPassword = '';
  lgpdAccepted = false;

  get passwordsMatch(): boolean {
    if (!this.isSignUp() || !this.confirmPassword) return true;
    return this.password === this.confirmPassword;
  }

  toggleSignUp() {
    this.isSignUp.update(v => !v);
    this.errorMessage.set('');
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    this.resetFields();
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update(v => !v);
  }

  formatPhone(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length > 11) {
      value = value.substring(0, 11);
    }
    
    if (value.length > 0) {
      value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
      value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    }
    
    this.phoneNumber = value;
    input.value = value;
  }

  private resetFields() {
    this.name = '';
    this.email = '';
    this.phoneNumber = '';
    this.password = '';
    this.confirmPassword = '';
    this.lgpdAccepted = false;
  }

  async onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage.set('Por favor, preencha o e-mail e a senha.');
      return;
    }

    if (this.isSignUp()) {
      if (!this.name || !this.phoneNumber) {
        this.errorMessage.set('Por favor, preencha todos os campos.');
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.errorMessage.set('As senhas não coincidem.');
        return;
      }
      if (!this.lgpdAccepted) {
        this.errorMessage.set('Você deve aceitar os Termos e Políticas para criar uma conta.');
        return;
      }
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      if (this.isSignUp()) {
        await this.authService.signup(this.email, this.password, this.name, this.phoneNumber);
      } else {
        await this.authService.login(this.email, this.password);
      }
      this.router.navigate(['/home']);
    } catch (error: any) {
      console.error('Erro na autenticação:', error);
      this.errorMessage.set(this.getFriendlyErrorMessage(error.code));
    } finally {
      this.isLoading.set(false);
    }
  }

  private getFriendlyErrorMessage(code: string): string {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'E-mail ou senha incorretos.';
      case 'auth/email-already-in-use':
        return 'Este e-mail já está sendo utilizado por outra conta.';
      case 'auth/weak-password':
        return 'A senha deve conter pelo menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'Insira um endereço de e-mail válido.';
      default:
        return 'Ocorreu um erro de autenticação. Por favor, tente novamente.';
    }
  }
}
