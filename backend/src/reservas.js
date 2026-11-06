function obterDataHora(valor, campo) {
    if (!(valor instanceof Date) && typeof valor !== 'string') {
        throw new TypeError(`${campo} deve ser uma data ou string.`);
    }

    const dataHora = valor instanceof Date
        ? valor
        : new Date(valor.replace(' ', 'T'));

    if (Number.isNaN(dataHora.getTime())) {
        throw new TypeError(`${campo} deve conter uma data válida.`);
    }

    return dataHora;
}

function obterData(valor, campo) {
    const dataHora = obterDataHora(valor, campo);
    if (typeof valor === 'string') {
        return valor.slice(0, 10);
    }

    return dataHora.toISOString().slice(0, 10);
}

function intervalosConflitam(inicioA, fimA, inicioB, fimB) {
    if (inicioA >= fimA || inicioB >= fimB) {
        throw new RangeError('O fim de cada reserva deve ser posterior ao início.');
    }

    return inicioA < fimB && inicioB < fimA;
}

export function horariosConflitam(inicioA, fimA, inicioB, fimB) {
    return intervalosConflitam(
        obterDataHora(inicioA, 'inicioA'),
        obterDataHora(fimA, 'fimA'),
        obterDataHora(inicioB, 'inicioB'),
        obterDataHora(fimB, 'fimB')
    );
}

export function existeConflito(novaReserva, reservas) {
    if (!novaReserva || typeof novaReserva !== 'object') {
        throw new TypeError('novaReserva deve ser um objeto.');
    }

    if (!Array.isArray(reservas)) {
        throw new TypeError('reservas deve ser uma lista.');
    }

    const inicioNovaReserva = obterDataHora(novaReserva.data_inicio, 'data_inicio');
    const fimNovaReserva = obterDataHora(novaReserva.data_fim, 'data_fim');
    if (inicioNovaReserva >= fimNovaReserva) {
        throw new RangeError('O fim da nova reserva deve ser posterior ao início.');
    }

    const dataNovaReserva = obterData(novaReserva.data_inicio, 'data_inicio');

    return reservas.some((reserva) => {
        const situacao = String(reserva.situacao ?? reserva.status ?? '')
            .trim()
            .toLowerCase();

        if (
            reserva.sala_id !== novaReserva.sala_id
            || situacao === 'cancelada'
            || situacao === 'canceladas'
            || obterData(reserva.data_inicio, 'data_inicio') !== dataNovaReserva
        ) {
            return false;
        }

        return intervalosConflitam(
            inicioNovaReserva,
            fimNovaReserva,
            obterDataHora(reserva.data_inicio, 'data_inicio'),
            obterDataHora(reserva.data_fim, 'data_fim')
        );
    });
}

export function cabeNaSala(quantidadeAlunos, salaId, salas) {
    if (!Number.isInteger(quantidadeAlunos) || quantidadeAlunos < 1) {
        throw new RangeError('quantidadeAlunos deve ser um inteiro positivo.');
    }

    if (
        (typeof salaId !== 'string' && typeof salaId !== 'number')
        || String(salaId).trim() === ''
        || (typeof salaId === 'number' && !Number.isFinite(salaId))
    ) {
        throw new TypeError('salaId deve ser um identificador válido.');
    }

    if (!Array.isArray(salas)) {
        throw new TypeError('salas deve ser uma lista.');
    }

    const sala = salas.find((item) => String(item.id) === String(salaId));
    if (!sala) {
        return false;
    }

    if (!Number.isInteger(sala.capacidade) || sala.capacidade < 1) {
        throw new TypeError('A capacidade da sala deve ser um inteiro positivo.');
    }

    return quantidadeAlunos <= sala.capacidade;
}
