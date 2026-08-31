# 💈 Coser Barber — Sistema de Agendamento & Gestão para Barbearia

Sistema web moderno e responsivo para gestão e agendamento de serviços de barbearia, desenvolvido com **Angular**, **Firebase (Firestore & Authentication)** e arquitetura baseada em **Signals** e **Standalone Components**.

---

## 🚀 Principais Funcionalidades

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

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [Angular](https://angular.dev/) (Standalone Components, Signals, Reactive Forms, Control Flow `@if`/`@for`).
- **Backend & Database**: [Google Firebase](https://firebase.google.com/) (Cloud Firestore & Authentication).
- **Estilização**: SCSS modular, Design System escuro/premium com efeitos visuais modernos e responsivos.
- **Ícones & Tipografia**: Font Awesome & Google Fonts (Playfair Display / Inter).

---

## ⚙️ Como Executar o Projeto Localmente

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 20 LTS ou superior recomendada)
- [Angular CLI](https://angular.dev/tools/cli)

### 2. Clonar o Repositório
```bash
git clone https://github.com/BRUNOKARLRAMLOW/Projeto-CoserBarber.git
cd Projeto-CoserBarber
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Configurar as Variáveis de Ambiente (Firebase)
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

### 5. Iniciar o Servidor de Desenvolvimento
```bash
npm start
# ou
ng serve
```
Acesse no seu navegador em: `http://localhost:4200/`

---

## 🔒 Segurança & Boas Práticas

- As credenciais de produção e chaves de acesso estão desacopladas do código fonte e protegidas através de variáveis de ambiente (`environment.ts` gerenciado via `.gitignore`).
- As regras de segurança do Firestore protegem o acesso a dados de clientes e configurações de barbeiros.

---

## 👨‍💻 Autor

Desenvolvido por **Bruno Karl Ramlow**.  
- [Instagram](https://www.instagram.com/bruno.ramlow/)

