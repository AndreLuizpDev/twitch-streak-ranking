# Ranking de Streaks

Site estático, responsivo e moderno para exibir o Top 10 dos maiores streaks de inscritos/subscritores de qualquer canal da Twitch.

## O que ele faz

- Consulta a API pública de streaks (configurável por canal)
- Ordena os usuários pelo maior `streak` (conversão numérica garantida)
- Exibe os 10 melhores resultados
- Mostra a posição, o nome do usuário, o valor do streak e a data da última atualização
- Permite atualizar os dados manualmente com o botão de refresh
- Trata erros de rede, HTTP, resposta inválida e lista vazia

## API utilizada

Este projeto consulta a API de streaks mantida por Tom Goulart:

https://lumosbot.app/api/twitch/streaks/:channel?limit={limit}

O repositório do autor da API: https://github.com/TomGoulart

A resposta esperada é um JSON com a estrutura `success`, `data` (lista) e `count`.

## Configuração do canal e limite

O canal consultado é definido diretamente em `script.js` na constante `TWITCH_CHANNEL`. Exemplo:

```javascript
const TWITCH_CHANNEL = "mrfalll"; // altere para qualquer outro canal
const API_LIMIT = 50;
const API_URL = `https://lumosbot.app/api/twitch/streaks/${TWITCH_CHANNEL}?limit=${API_LIMIT}`;
```

Ao alterar `TWITCH_CHANNEL`, o link exibido no site e a URL da API são atualizados automaticamente.

## Proxy CORS e desenvolvimento

Como a API externa pode não permitir CORS direto em navegadores, o projeto oferece duas opções:

- Usar um proxy público (fallback) — `api.allorigins.win` — útil para demos rápidas.
- Rodar um proxy local (recomendado em desenvolvimento) que encaminha as requisições e adiciona os cabeçalhos CORS.

Para rodar o proxy local (opcional):

```bash
npm install
npm run dev
```

O proxy roda por padrão em `http://localhost:3000` e expõe `/proxy/streaks/:channel`.

## Créditos

- API de streaks: https://github.com/TomGoulart
- Site / implementação front-end: https://github.com/AndreLuizpDev

## Como executar localmente

1. Sirva os arquivos estáticos (ex.: `npx serve . -l 8000` ou `python -m http.server 8000`).
2. (Opcional) Inicie o proxy local como explicado acima.
3. Abra `http://localhost:8000` no navegador.

## Publicação (GitHub Pages)

1. Faça o push do projeto para um repositório no GitHub.
2. Em `Settings` > `Pages`, selecione a branch e a pasta raiz.
3. O site ficará disponível em `https://seu-usuario.github.io/seu-repositorio/`.

## Estrutura do projeto

```
/
├── index.html
├── style.css
├── script.js
├── README.md
```

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)

## Observações

- O projeto é agnóstico ao canal: altere `TWITCH_CHANNEL` em `script.js` para apontar para qualquer canal da Twitch.
- Nenhuma chave secreta é necessária.
