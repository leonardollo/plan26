import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const { acesso, usuarios } = vi.hoisted(() => ({
  acesso: { listarAcessos: vi.fn(), definirStatus: vi.fn(), listarAdmins: vi.fn(), promoverAdmin: vi.fn() },
  usuarios: { criarCliente: vi.fn(), reenviarEmailDeSenha: vi.fn() },
}));

vi.mock('../../services/supabase', () => ({ supabase: {} }));
vi.mock('../../services/acesso', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/acesso')>()),
  ...acesso,
}));
vi.mock('../../services/adminUsuarios', () => usuarios);

import AbaClientes from './AbaClientes';

const pessoa = (uid: string, nome: string, email: string, status: string) => ({ uid, nome, email, status });
const LISTA = [
  pessoa('p1', 'Ana Pendente', 'ana@x.com', 'pendente'),
  pessoa('l1', 'Bruno Liberado', 'bruno@x.com', 'liberado'),
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
  vi.clearAllMocks();
  acesso.listarAcessos.mockResolvedValue(LISTA);
  acesso.listarAdmins.mockResolvedValue(ADMINS);
  acesso.definirStatus.mockResolvedValue(undefined);
  acesso.promoverAdmin.mockResolvedValue(undefined);
  usuarios.reenviarEmailDeSenha.mockResolvedValue(undefined);
});
afterEach(cleanup);

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
    expect(acoes('bruno@x.com')).toEqual(['Bloquear', 'Remover', 'Reenviar e-mail de senha', 'Abrir plano', 'Tornar admin']);
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
});
