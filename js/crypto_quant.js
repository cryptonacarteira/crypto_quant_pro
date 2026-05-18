const streamUrl = "https://streaming.forexpros.com/echo/643/rtd_stream/websocket";
const pidsParaAssinar = [18693, 18712, 18683, 18621, 18615, 18610, 18591];

let estadoAtivos = {};
pidsParaAssinar.forEach(pid => {
    estadoAtivos[`pid-${pid}`] = { ultimo: 0, abertura: 0, varAbertura: 0 };
});

let socket = new WebSocket(streamUrl);

socket.onopen = function() {
    pidsParaAssinar.forEach(pid => {
        socket.send(JSON.stringify({ "subscribe_ids": [pid] }));
    });
};

socket.onmessage = function(event) {
    try {
        let msg = JSON.parse(event.data);
        if (msg && msg.pid && pidsParaAssinar.includes(parseInt(msg.pid))) {
            atualizarPainelInvesting(msg);
        }
    } catch (e) {}
};

function atualizarPainelInvesting(data) {
    const pidKey = `pid-${data.pid}`;
    const linha = document.getElementById(pidKey);
    if (!linha) return;

    const cellUltimo = linha.querySelector('.ultimo');
    const cellAbertura = linha.querySelector('.abertura');
    const cellMaxima = linha.querySelector('.maxima');
    const cellMinima = linha.querySelector('.minima');
    const cellFechamento = linha.querySelector('.var-fechamento');
    const cellQuantAbertura = linha.querySelector('.var-abertura');

    // 1. Atualização com efeito Flash no Último Preço
    if (data.last && cellUltimo) {
        let novoPreco = parseFloat(data.last);
        let precoAnterior = estadoAtivos[pidKey].ultimo;
        
        cellUltimo.innerText = novoPreco.toFixed(2).replace('.', ',');
        
        if (precoAnterior > 0) {
            if (novoPreco > precoAnterior) {
                cellUltimo.parentElement.classList.add('bg-up-flash');
                setTimeout(() => cellUltimo.parentElement.classList.remove('bg-up-flash'), 400);
            } else if (novoPreco < precoAnterior) {
                cellUltimo.parentElement.classList.add('bg-down-flash');
                setTimeout(() => cellUltimo.parentElement.classList.remove('bg-down-flash'), 400);
            }
        }
        estadoAtivos[pidKey].ultimo = novoPreco;
    }

    // 2. Preenche colunas do intraday
    if (data.open && cellAbertura) {
        estadoAtivos[pidKey].abertura = parseFloat(data.open);
        cellAbertura.innerText = parseFloat(data.open).toFixed(2).replace('.', ',');
    }
    if (data.high && cellMaxima) cellMaxima.innerText = parseFloat(data.high).toFixed(2).replace('.', ',');
    if (data.low && cellMinima) cellMinima.innerText = parseFloat(data.low).toFixed(2).replace('.', ',');

    // 3. Var% Tradicional (Em relação ao Fechamento de ontem)
    if (data.pcp && cellFechamento) {
        let vFech = parseFloat(data.pcp.replace('%', '').replace(',', '.'));
        cellFechamento.innerText = (vFech >= 0 ? '+' : '') + vFech.toFixed(2).replace('.', ',') + '%';
        aplicarCorTexto(cellFechamento, vFech);
    }

    // 4. CÁLCULO QUANT: Var% Real (Em relação à Abertura de Hoje)
    if (cellQuantAbertura && estadoAtivos[pidKey].abertura > 0 && estadoAtivos[pidKey].ultimo > 0) {
        let atual = estadoAtivos[pidKey].ultimo;
        let aberta = estadoAtivos[pidKey].abertura;
        
        let vQuant = ((atual / aberta) - 1) * 100;
        estadoAtivos[pidKey].varAbertura = vQuant;
        
        cellQuantAbertura.innerText = (vQuant >= 0 ? '+' : '') + vQuant.toFixed(2).replace('.', ',') + '%';
        aplicarCorTexto(cellQuantAbertura, vQuant);
    }

    // Atualiza o termômetro geral
    calcularTermometroMercado();
}

function aplicarCorTexto(elemento, valor) {
    elemento.style.color = valor > 0 ? '#00c853' : (valor < 0 ? '#ff3d00' : '#ffffff');
}

function calcularTermometroMercado() {
    let soma = 0;
    let ativosValidos = 0;

    pidsParaAssinar.forEach(pid => {
        let vAbertura = estadoAtivos[`pid-${pid}`].varAbertura;
        if (estadoAtivos[`pid-${pid}`].abertura > 0) {
            soma += vAbertura;
            ativosValidos++;
        }
    });

    const labelAvg = document.getElementById('quantipro-avg');
    if (labelAvg && ativosValidos > 0) {
        let mediaGeral = soma / ativosValidos;
        labelAvg.innerText = (mediaGeral >= 0 ? '+' : '') + mediaGeral.toFixed(2).replace('.', ',') + '%';
        labelAvg.style.color = mediaGeral > 0 ? '#00c853' : (mediaGeral < 0 ? '#ff3d00' : '#ffffff');
    }
}

socket.onclose = function() {
    setTimeout(() => { socket = new WebSocket(streamUrl); }, 5000);
};