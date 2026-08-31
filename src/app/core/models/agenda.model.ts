export interface Servico {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  duracaoMinutos: number;
}

export interface ProdutoAdicional {
  nome: string;
  quantidade: number;
  valor: number;
}

export interface Agendamento {
  id: string;
  clienteNome: string;
  clienteUid?: string;
  clienteTelefone?: string;
  servicoId: string;
  barbeiroId: 'coser' | 'filippi';
  data: string;    // YYYY-MM-DD
  horario: string; // HH:mm
  usouPlano?: boolean;
  categoriaEspecial?: 'idoso' | 'pcd' | 'vip' | 'outro';
  precoCustomizado?: number;
  produtos?: ProdutoAdicional[];
}

export interface BloqueioConfig {
  inicio: string; // HH:mm
  fim: string;    // HH:mm
}

export interface DiaConfig {
  diaNome: string;
  ativo: boolean;
  inicio: string; // HH:mm
  fim: string;    // HH:mm
  bloqueios?: BloqueioConfig[];
}

export interface BarbeiroConfig {
  barbeiroId: 'coser' | 'filippi';
  nome: string;
  dias: {
    [dayIndex: number]: DiaConfig;
  };
}
