# 💈 Coser Barber — Barbershop Management & Scheduling System

<p align="center">
  <a href="#english">English</a> •
  <a href="#português">Português</a>
</p>

---

<a name="english"></a>
## 🇺🇸 English

Modern and responsive web application for barbershop management and online service scheduling, built with **Angular**, **Firebase (Cloud Firestore & Authentication)**, and designed using modern **Signals** and **Standalone Components** architecture.

---

### 🚀 Key Features

- **Real-Time Smart Scheduling**:
  - Barber selection, date picker, and dynamic available time slots.
  - Real-time Firestore synchronization to prevent double-booking.
  - Support for multiple services and add-on products (drinks, hair styling pomades, etc.).
- **Authentication & Access Control**:
  - Secure customer and barber/admin registration and login via Firebase Auth.
  - Subscription plan management (e.g., Silver, Gold, VIP) with haircut allowances and periodic renewal rules.
  - Persistent session with a 7-day sliding expiration mechanism.
- **Barber Admin Dashboard**:
  - Daily schedule overview and monthly interactive calendar.
  - Customizable working hours and time-slot blocking.
  - Customer management and subscription plan updates.
- **Contact & Social Media Integration**:
  - WhatsApp integration for automatic messages with pre-filled appointment details.

---

### 🛠️ Tech Stack

- **Frontend**: [Angular](https://angular.dev/) (Standalone Components, Signals, Reactive Forms, `@if`/`@for` Control Flow).
- **Backend & Database**: [Google Firebase](https://firebase.google.com/) (Cloud Firestore & Authentication).
- **Styling**: Modular SCSS, dark & premium design system with modern responsive visual effects.
- **Icons & Typography**: Font Awesome & Google Fonts (Playfair Display / Inter).

---

### ⚙️ Getting Started Locally

#### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 20 LTS or higher recommended)
- [Angular CLI](https://angular.dev/tools/cli)

#### 2. Clone the Repository
```bash
git clone https://github.com/BRUNOKARLRAMLOW/Projeto-CoserBarber.git
cd Projeto-CoserBarber
```

#### 3. Install Dependencies
```bash
npm install
```

#### 4. Configure Environment Variables (Firebase)
Copy the example environment file:
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

Open `src/environments/environment.ts` and fill in your Firebase Console project credentials:
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  },
  firestoreDatabaseId: '(default)',
  recaptchaSiteKey: ''
};
```

#### 5. Run the Development Server
```bash
npm start
# or
ng serve
```
Open your browser and navigate to: `http://localhost:4200/`

---

### 🔒 Security & Best Practices

- Production credentials and access keys are decoupled from source code and protected using environment variables (`environment.ts` ignored via `.gitignore`).
- Firestore security rules protect access to customer data and barber configurations.

---

<a name="português"></a>
## 🇧🇷 Português

Sistema web moderno e responsivo para gestão e agendamento de serviços de barbearia, desenvolvido com **Angular**, **Firebase (Firestore & Authentication)** e arquitetura baseada em **Signals** e **Standalone Components**.

---

### 🚀 Principais Funcionalidades

- **Agendamento Inteligente em Tempo Real**:
  - Seleção de profissional (barbeiro), data e horários disponíveis.
  - Sincronização em tempo real via Firestore para evitar choque de horários.
  - Suporte a múltiplos serviços e produtos adicionais (bebidas, pomadas, etc.).
- **Autenticação & Controle de Acesso**:
  - Cadastro e Login seguro de clientes e administradores/barbeiros via Firebase Auth.
  - Gestão de planos de assinatura (ex: Silver, Gold, VIP) com cotas de cortes e regras de renovação periódica.
  - Sessão persistente com mecanismo de expiração deslizante de 7 dias.
- **Painel Administrativo do Barbeiro**:
  - Visão geral da agenda diária e calendário mensal.
  - Configuração customizada de expediente e bloqueio de horários.
  - Gestão de clientes e alteração de planos.
- **Área de Contato & Redes Sociais**:
  - Integração com WhatsApp para envio de mensagens automáticas com dados pré-preenchidos.

---

### 🛠️ Tecnologias Utilizadas

- **Frontend**: [Angular](https://angular.dev/) (Standalone Components, Signals, Reactive Forms, Control Flow `@if`/`@for`).
- **Backend & Database**: [Google Firebase](https://firebase.google.com/) (Cloud Firestore & Authentication).
- **Estilização**: SCSS modular, Design System escuro/premium com efeitos visuais modernos e responsivos.
- **Ícones & Tipografia**: Font Awesome & Google Fonts (Playfair Display / Inter).

---

### ⚙️ Como Executar o Projeto Localmente

#### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 20 LTS ou superior recomendada)
- [Angular CLI](https://angular.dev/tools/cli)

#### 2. Clonar o Repositório
```bash
git clone https://github.com/BRUNOKARLRAMLOW/Projeto-CoserBarber.git
cd Projeto-CoserBarber
```

#### 3. Instalar Dependências
```bash
npm install
```

#### 4. Configurar as Variáveis de Ambiente (Firebase)
Copie o arquivo de exemplo de ambiente:
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

Abra o arquivo `src/environments/environment.ts` e preencha com as credenciais do seu projeto no Firebase Console:
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.firebasestorage.app",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
  },
  firestoreDatabaseId: '(default)',
  recaptchaSiteKey: ''
};
```

#### 5. Iniciar o Servidor de Desenvolvimento
```bash
npm start
# ou
ng serve
```
Acesse no seu navegador em: `http://localhost:4200/`

---

### 🔒 Segurança & Boas Práticas

- As credenciais de produção e chaves de acesso estão desacopladas do código fonte e protegidas através de variáveis de ambiente (`environment.ts` gerenciado via `.gitignore`).
- As regras de segurança do Firestore protegem o acesso a dados de clientes e configurações de barbeiros.

---

## 👨‍💻 Autor / Author

Desenvolvido por / Developed by **Bruno Karl Ramlow**.  
- [Instagram](https://www.instagram.com/bruno.ramlow/)
