import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cabeNaSala, existeConflito, horariosConflitam } from '../src/reservas.js';

const novaReserva = {
    sala_id: 1,
    data_inicio: '2026-11-02 09:00:00',
    data_fim: '2026-11-02 10:00:00',
    situacao: 'pendente'
};

test('detecta sobreposição na mesma sala e data', () => {
    const reservas = [{
        sala_id: 1,
        data_inicio: '2026-11-02 09:30:00',
        data_fim: '2026-11-02 10:30:00',
        situacao: 'aprovada'
    }];

    assert.equal(existeConflito(novaReserva, reservas), true);
});

test('ignora reserva cancelada com situacao singular ou plural', () => {
    const reservas = ['cancelada', 'canceladas'].map((situacao) => ({
        sala_id: 1,
        data_inicio: '2026-11-02 09:30:00',
        data_fim: '2026-11-02 10:30:00',
        situacao
    }));

    assert.equal(existeConflito(novaReserva, reservas), false);
});

test('ignora reserva com status cancelada', () => {
    const reservas = [{
        sala_id: 1,
        data_inicio: '2026-11-02 09:30:00',
        data_fim: '2026-11-02 10:30:00',
        status: 'cancelada'
    }];

    assert.equal(existeConflito(novaReserva, reservas), false);
});

test('nao detecta conflito quando os horarios nao se sobrepoem', () => {
    const reservas = [
        {
            sala_id: 1,
            data_inicio: '2026-11-02 08:00:00',
            data_fim: '2026-11-02 09:00:00',
            situacao: 'aprovada'
        },
        {
            sala_id: 1,
            data_inicio: '2026-11-02 10:00:00',
            data_fim: '2026-11-02 11:00:00',
            situacao: 'pendente'
        }
    ];

    assert.equal(existeConflito(novaReserva, reservas), false);
});

test('horariosConflitam considera intervalos adjacentes sem sobreposicao', () => {
    assert.equal(
        horariosConflitam(
            '2026-11-02 08:00:00',
            '2026-11-02 09:00:00',
            '2026-11-02 09:00:00',
            '2026-11-02 10:00:00'
        ),
        false
    );
});

test('nao detecta conflito em outra sala ou em outra data', () => {
    const reservas = [
        {
            sala_id: 2,
            data_inicio: '2026-11-02 09:30:00',
            data_fim: '2026-11-02 10:30:00',
            situacao: 'aprovada'
        },
        {
            sala_id: 1,
            data_inicio: '2026-11-03 09:30:00',
            data_fim: '2026-11-03 10:30:00',
            situacao: 'aprovada'
        }
    ];

    assert.equal(existeConflito(novaReserva, reservas), false);
});

test('cabeNaSala aceita turma menor ou igual a capacidade', () => {
    const salas = [{ id: 1, capacidade: 30 }];

    assert.equal(cabeNaSala(20, 1, salas), true);
    assert.equal(cabeNaSala(30, '1', salas), true);
});

test('cabeNaSala rejeita turma maior que a capacidade', () => {
    assert.equal(cabeNaSala(31, 1, [{ id: 1, capacidade: 30 }]), false);
});

test('cabeNaSala retorna falso quando a sala nao existe', () => {
    assert.equal(cabeNaSala(10, 2, [{ id: 1, capacidade: 30 }]), false);
});

test('cabeNaSala rejeita quantidade de alunos invalida e lista de salas invalida', () => {
    assert.throws(() => cabeNaSala(0, 1, []), /inteiro positivo/);
    assert.throws(() => cabeNaSala(1, 1, null), /salas deve ser uma lista/);
});
