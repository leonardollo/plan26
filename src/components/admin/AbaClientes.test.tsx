import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const { acesso, usuarios } = vi.hoisted(() => ({
  acesso: {
    listarAcessos: vi.fn(), definirStatus: vi.fn(), listarAdmins: vi.fn(), promoverAdmin: vi.fn(), tirarPrazo: vi.fn(),
    definirPrazo: vi.fn(),
  },
  usuarios: { criarCliente: vi.fn(), reenviarEmailDeSenha: vi.fn() },
}));

vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('../../services/acesso', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/acesso')>()),
  ...acesso,
}));
vi.mock('../../services/adminUsuarios', () => usuarios);

import AbaClientes from './AbaClientes';

const pessoa = (uid: string, nome: string, email: string, status: string, acessoAte: string | null = null) => ({
  uid,
  nome,
  email,
  status,
  acessoAte,
});
const LISTA = [
  pessoa('p1', 'Ana Pendente', 'ana@x.com', 'pendente'),
  pessoa('l1', 'Bruno Liberado', 'bruno@x.com', 'liberado'),
  // Fim do dia em São Paulo, como admin_definir_prazo grava: 13/11/2027 e 10/11/2026.
  pessoa('l2', 'Fabi Paga', 'fabi@x.com', 'liberado', '2027-11-14T02:59:59.999Z'),
  pessoa('l3', 'Gil Vencido', 'gil@x.com', 'liberado', '2026-11-11T02:59:59.999Z'),
  pessoa('b1', 'Carla Bloqueada', 'carla@x.com', 'bloqueado'),
  pessoa('r1', 'Davi Removido', 'davi@x.com', 'removido'),
  pessoa('a2', 'Eva Admin', 'eva@gi.com', 'liberado'),
  pessoa('eu', 'Eu Mesmo', 'eu@gi.com', 'liberado'),
];
const ADMINS = [
  { email: 'eva@gi.com', uid: 'a2', nome: 'Eva Admin' },
  { email: 'eu@gi.com', uid: 'eu', nome: 'Eu Mesmo' },
];

const abrir = vi.fn();

async function montar() {
  render(<AbaClientes eu={{ uid: 'eu', email: 'eu@gi.com' }} onAbrirPlano={abrir} />);
  await act(async () => {});
}

const linha = (email: string) => screen.getByLabelText(`Cliente ${email}`);
const acoes = (email: string) => within(linha(email)).queryAllByRole('button').map((b) => b.textContent);
const filtrar = (nome: RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }));

beforeEach(() => {
  // why: só o Date é falso (promessas seguem reais); "hoje" = 13/11/2026, meio-dia em São Paulo.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T15:00:00Z'));
  vi.clearAllMocks();
  acesso.listarAcessos.mockResolvedValue(LISTA);
  acesso.listarAdmins.mockResolvedValue(ADMINS);
  acesso.definirStatus.mockResolvedValue(undefined);
  acesso.promoverAdmin.mockResolvedValue(undefined);
  acesso.tirarPrazo.mockResolvedValue(undefined);
  usuarios.reenviarEmailDeSenha.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AbaClientes', () => {
  it('sem filtro mostra todos menos os removidos', async () => {
    await montar();
    expect(screen.getByText('Ana Pendente')).toBeTruthy();
    expect(screen.getByText('Eva Admin')).toBeTruthy();
    expect(screen.queryByText('Davi Removido')).toBeNull();
  });

  it('busca por nome e por e-mail', async () => {
    await montar();
    const busca = screen.getByLabelText('Buscar cliente');
    fireEvent.change(busca, { target: { value: 'bruno' } });
    expect(screen.getByText('Bruno Liberado')).toBeTruthy();
    expect(screen.queryByText('Ana Pendente')).toBeNull();
    fireEvent.change(busca, { target: { value: 'CARLA@x' } });
    expect(screen.getByText('Carla Bloqueada')).toBeTruthy();
    expect(screen.queryByText('Bruno Liberado')).toBeNull();
  });

  it('filtros Pendentes, Liberados, Bloqueados e Removidos', async () => {
    await montar();
    filtrar(/^Pendentes/);
    expect(screen.getByText('Ana Pendente')).toBeTruthy();
    expect(screen.queryByText('Bruno Liberado')).toBeNull();
    filtrar(/^Liberados/);
    expect(screen.getByText('Bruno Liberado')).toBeTruthy();
    expect(screen.queryByText('Ana Pendente')).toBeNull();
    filtrar(/^Bloqueados/);
    expect(screen.getByText('Carla Bloqueada')).toBeTruthy();
    expect(screen.queryByText('Bruno Liberado')).toBeNull();
    filtrar(/^Removidos/);
    expect(screen.getByText('Davi Removido')).toBeTruthy();
    expect(screen.queryByText('Carla Bloqueada')).toBeNull();
  });

  it('as ações de cada status, de outro admin e da própria linha', async () => {
    await montar();
    expect(acoes('ana@x.com')).toEqual(['Liberar', 'Bloquear', 'Remover', 'Reenviar e-mail de senha', 'Abrir plano', 'Tornar admin']);
    expect(acoes('bruno@x.com')).toEqual(['Alterar prazo', 'Bloquear', 'Remover', 'Reenviar e-mail de senha', 'Abrir plano', 'Tornar admin']);
    expect(acoes('carla@x.com')).toEqual(['Liberar', 'Remover', 'Abrir plano']);
    expect(acoes('eva@gi.com')).toEqual(['Abrir plano']);
    expect(acoes('eu@gi.com')).toEqual([]);
    filtrar(/^Removidos/);
    expect(acoes('davi@x.com')).toEqual(['Reativar', 'Abrir plano']);
  });

  it('Liberar, Bloquear e Reativar chamam definirStatus com o status certo', async () => {
    await montar();
    fireEvent.click(within(linha('ana@x.com')).getByRole('button', { name: 'Liberar' }));
    await act(async () => {});
    expect(acesso.definirStatus).toHaveBeenLastCalledWith(expect.anything(), 'p1', 'liberado');
    fireEvent.click(within(linha('bruno@x.com')).getByRole('button', { name: 'Bloquear' }));
    await act(async () => {});
    expect(acesso.definirStatus).toHaveBeenLastCalledWith(expect.anything(), 'l1', 'bloqueado');
    filtrar(/^Removidos/);
    fireEvent.click(within(linha('davi@x.com')).getByRole('button', { name: 'Reativar' }));
    await act(async () => {});
    expect(acesso.definirStatus).toHaveBeenLastCalledWith(expect.anything(), 'r1', 'liberado');
  });

  it('Remover pede confirmação e só remove depois de confirmar', async () => {
    await montar();
    fireEvent.click(within(linha('bruno@x.com')).getByRole('button', { name: 'Remover' }));
    expect(screen.getByText(/Remover Bruno Liberado\?/)).toBeTruthy();
    expect(acesso.definirStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(acesso.definirStatus).not.toHaveBeenCalled();
    fireEvent.click(within(linha('bruno@x.com')).getByRole('button', { name: 'Remover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar remoção' }));
    await act(async () => {});
    expect(acesso.definirStatus).toHaveBeenCalledWith(expect.anything(), 'l1', 'removido');
    // Removido sai da lista sem filtro.
    expect(screen.queryByText('Bruno Liberado')).toBeNull();
  });

  it('Reenviar no limite de envios: mostra a mensagem do 429', async () => {
    usuarios.reenviarEmailDeSenha.mockRejectedValue(new Error('Muitos envios; tente de novo em 12 min'));
    await montar();
    fireEvent.click(within(linha('ana@x.com')).getByRole('button', { name: 'Reenviar e-mail de senha' }));
    await act(async () => {});
    expect(screen.getByRole('alert').textContent).toBe('Muitos envios; tente de novo em 12 min');
  });

  it('Reenviar, Abrir plano e Tornar admin', async () => {
    await montar();
    fireEvent.click(within(linha('ana@x.com')).getByRole('button', { name: 'Reenviar e-mail de senha' }));
    await act(async () => {});
    expect(usuarios.reenviarEmailDeSenha).toHaveBeenCalledWith(expect.anything(), 'p1');
    expect(screen.getByText('E-mail de senha enviado para ana@x.com.')).toBeTruthy();

    fireEvent.click(within(linha('carla@x.com')).getByRole('button', { name: 'Abrir plano' }));
    expect(abrir).toHaveBeenCalledWith({ uid: 'b1', email: 'carla@x.com', nome: 'Carla Bloqueada' });

    fireEvent.click(within(linha('bruno@x.com')).getByRole('button', { name: 'Tornar admin' }));
    await act(async () => {});
    expect(acesso.promoverAdmin).toHaveBeenCalledWith(expect.anything(), 'bruno@x.com');
  });

  it('o erro do banco aparece na tela', async () => {
    acesso.definirStatus.mockRejectedValue({ code: 'P0001', message: 'Rebaixe antes de bloquear um administrador' });
    await montar();
    fireEvent.click(within(linha('bruno@x.com')).getByRole('button', { name: 'Bloquear' }));
    await act(async () => {});
    expect(screen.getByText('Rebaixe antes de bloquear um administrador')).toBeTruthy();
  });

  describe('Adicionar cliente', () => {
    async function adicionar() {
      await montar();
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar cliente' }));
      fireEvent.change(screen.getByLabelText('E-mail do cliente'), { target: { value: 'novo@x.com' } });
      fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Novo Cliente' } });
      fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }));
      await act(async () => {});
    }

    it('criado: avisa que o e-mail saiu e recarrega a lista', async () => {
      usuarios.criarCliente.mockResolvedValue({ resultado: 'criado' });
      await adicionar();
      expect(usuarios.criarCliente).toHaveBeenCalledWith(expect.anything(), 'novo@x.com', 'Novo Cliente');
      expect(screen.getByText('Cliente criado e liberado. O e-mail "Defina sua senha" foi para novo@x.com.')).toBeTruthy();
      expect(acesso.listarAcessos).toHaveBeenCalledTimes(2);
    });

    it('criado_sem_email: manda usar Reenviar', async () => {
      usuarios.criarCliente.mockResolvedValue({ resultado: 'criado_sem_email' });
      await adicionar();
      expect(screen.getByText(/o e-mail de senha não saiu: use Reenviar/)).toBeTruthy();
    });

    it('ja_existe: mostra o status e nada muda', async () => {
      usuarios.criarCliente.mockResolvedValue({ resultado: 'ja_existe', status: 'bloqueado', alvo: 'b1' });
      await adicionar();
      expect(screen.getByText('Esse e-mail já existe (Bloqueado). Nada mudou.')).toBeTruthy();
      expect(acesso.definirStatus).not.toHaveBeenCalled();
    });

    it('ja_existe de administrador', async () => {
      usuarios.criarCliente.mockResolvedValue({ resultado: 'ja_existe', status: 'administrador' });
      await adicionar();
      expect(screen.getByText('Esse e-mail já existe (administrador). Nada mudou.')).toBeTruthy();
    });

    it('ja_existe removido: oferece Reativar', async () => {
      usuarios.criarCliente.mockResolvedValue({ resultado: 'ja_existe', status: 'removido', alvo: 'r1' });
      await adicionar();
      expect(screen.getByText('Esse e-mail já existe (Removido). Nada mudou.')).toBeTruthy();
      fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Reativar' }));
      await act(async () => {});
      expect(acesso.definirStatus).toHaveBeenCalledWith(expect.anything(), 'r1', 'liberado');
    });

    it('a recusa da função aparece na tela', async () => {
      usuarios.criarCliente.mockRejectedValue(new Error('E-mail inválido'));
      await adicionar();
      expect(screen.getByText('E-mail inválido')).toBeTruthy();
    });
  });

  describe('tempo de acesso', () => {
    const abrirPainel = (email: string) =>
      fireEvent.click(within(linha(email)).getByRole('button', { name: 'Alterar prazo' }));
    const campo = (email: string) => within(linha(email)).getByLabelText('Último dia de acesso') as HTMLInputElement;
    const clicar = (email: string, nome: string) =>
      fireEvent.click(within(linha(email)).getByRole('button', { name: nome }));

    it('mostra o prazo com os dias que faltam ou que passaram', async () => {
      await montar();
      expect(within(linha('bruno@x.com')).getByText('Sem prazo')).toBeTruthy();
      expect(within(linha('fabi@x.com')).getByText('Acesso até 13/11/2027 · faltam 365 dias')).toBeTruthy();
      expect(within(linha('gil@x.com')).getByText('Vencido em 10/11/2026 · há 3 dias')).toBeTruthy();
    });

    it('Alterar prazo aparece para todo liberado; não para pendente, bloqueado, removido, admin ou a própria linha', async () => {
      await montar();
      for (const email of ['bruno@x.com', 'fabi@x.com', 'gil@x.com']) expect(acoes(email), email).toContain('Alterar prazo');
      for (const email of ['ana@x.com', 'carla@x.com', 'eva@gi.com', 'eu@gi.com']) {
        expect(acoes(email), email).not.toContain('Alterar prazo');
      }
      filtrar(/^Removidos/);
      expect(acoes('davi@x.com')).not.toContain('Alterar prazo');
    });

    it('o campo começa no dia do prazo que ainda vale; vazio quando vencido ou sem prazo', async () => {
      await montar();
      abrirPainel('fabi@x.com');
      expect(campo('fabi@x.com').value).toBe('2027-11-13');
      clicar('fabi@x.com', 'Cancelar');
      abrirPainel('gil@x.com');
      expect(campo('gil@x.com').value).toBe('');
    });

    it('atalhos partem do prazo que vale, senão de hoje, e só preenchem a data', async () => {
      await montar();
      abrirPainel('fabi@x.com');
      clicar('fabi@x.com', '+1 ano');
      expect(campo('fabi@x.com').value).toBe('2028-11-13');
      clicar('fabi@x.com', '+1 ano');
      expect(campo('fabi@x.com').value).toBe('2028-11-13');
      clicar('fabi@x.com', 'Cancelar');

      abrirPainel('gil@x.com');
      clicar('gil@x.com', '+30 dias');
      expect(campo('gil@x.com').value).toBe('2026-12-13');
      clicar('gil@x.com', 'Cancelar');

      abrirPainel('bruno@x.com');
      clicar('bruno@x.com', '+1 ano');
      expect(campo('bruno@x.com').value).toBe('2027-11-13');
      expect(acesso.definirPrazo).not.toHaveBeenCalled();
    });

    it('Salvar com hoje, passado ou vazio mostra a mensagem e não chama o banco', async () => {
      await montar();
      abrirPainel('bruno@x.com');
      clicar('bruno@x.com', 'Salvar');
      expect(within(linha('bruno@x.com')).getByRole('alert').textContent).toBe('Escolha uma data');
      fireEvent.change(campo('bruno@x.com'), { target: { value: '2026-11-13' } });
      clicar('bruno@x.com', 'Salvar');
      expect(within(linha('bruno@x.com')).getByRole('alert').textContent).toBe(
        'Escolha uma data futura; para cortar o acesso, use Bloquear',
      );
      fireEvent.change(campo('bruno@x.com'), { target: { value: '2031-11-14' } });
      clicar('bruno@x.com', 'Salvar');
      expect(within(linha('bruno@x.com')).getByRole('alert').textContent).toBe('O prazo vai até 5 anos à frente');
      expect(acesso.definirPrazo).not.toHaveBeenCalled();
    });

    it('Salvar grava, atualiza o rótulo, fecha o painel e avisa', async () => {
      acesso.definirPrazo.mockResolvedValue('2027-11-14T02:59:59.999999+00:00');
      await montar();
      abrirPainel('bruno@x.com');
      clicar('bruno@x.com', '+1 ano');
      await act(async () => clicar('bruno@x.com', 'Salvar'));
      expect(acesso.definirPrazo).toHaveBeenCalledWith({}, 'l1', '2027-11-13');
      expect(within(linha('bruno@x.com')).getByText('Acesso até 13/11/2027 · faltam 365 dias')).toBeTruthy();
      expect(within(linha('bruno@x.com')).queryByLabelText('Último dia de acesso')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('bruno@x.com agora tem acesso até 13/11/2027.');
    });

    it('a recusa do banco aparece na tela e o painel continua aberto', async () => {
      acesso.definirPrazo.mockRejectedValue({ code: '22023', message: 'o prazo só vale para cliente liberado: libere antes' });
      await montar();
      abrirPainel('bruno@x.com');
      clicar('bruno@x.com', '+30 dias');
      await act(async () => clicar('bruno@x.com', 'Salvar'));
      expect(screen.getByText('o prazo só vale para cliente liberado: libere antes')).toBeTruthy();
      expect(campo('bruno@x.com').value).toBe('2026-12-13');
    });

    it('Sem prazo só aparece com prazo e chama tirarPrazo', async () => {
      await montar();
      abrirPainel('bruno@x.com');
      expect(within(linha('bruno@x.com')).queryByRole('button', { name: 'Sem prazo' })).toBeNull();
      clicar('bruno@x.com', 'Cancelar');

      abrirPainel('gil@x.com');
      await act(async () => clicar('gil@x.com', 'Sem prazo'));
      expect(acesso.tirarPrazo).toHaveBeenCalledWith({}, 'l3');
      expect(within(linha('gil@x.com')).getByText('Sem prazo')).toBeTruthy();
      expect(within(linha('gil@x.com')).queryByLabelText('Último dia de acesso')).toBeNull();
    });

    it('Cancelar fecha sem gravar', async () => {
      await montar();
      abrirPainel('fabi@x.com');
      clicar('fabi@x.com', '+1 ano');
      clicar('fabi@x.com', 'Cancelar');
      expect(within(linha('fabi@x.com')).queryByLabelText('Último dia de acesso')).toBeNull();
      expect(acesso.definirPrazo).not.toHaveBeenCalled();
      expect(within(linha('fabi@x.com')).getByText('Acesso até 13/11/2027 · faltam 365 dias')).toBeTruthy();
    });
  });
});
