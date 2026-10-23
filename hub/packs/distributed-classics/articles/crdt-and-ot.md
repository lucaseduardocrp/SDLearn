---
title: CRDTs e Operational Transformation
category: Tempo real
summary: As duas famílias de algoritmos que fazem edições concorrentes convergirem.
readingMinutes: 7
relatedProblems: [collaborative-editor, file-sync]
---
Ana apaga a palavra 3 enquanto Bruno insere texto na posição 10. Se cada um aplicar a operação do outro "como veio", os documentos divergem. Dois caminhos resolvem isso.

## Operational Transformation (OT)

Um servidor central ordena as operações. Antes de aplicar uma operação concorrente, ela é **transformada** contra as que vieram antes ("a inserção na posição 10 vira posição 4, porque 6 caracteres foram apagados antes dela").

- Funciona muito bem com um servidor por documento (o Google Docs usa essa ideia).
- As funções de transformação são difíceis de acertar e de provar corretas.
- Edição offline longa é complicada: muitas operações para transformar.

## CRDTs

Estruturas de dados desenhadas para que **qualquer ordem** de aplicação produza o mesmo resultado. Cada caractere ganha um identificador único e ordenável; inserir e apagar viram operações comutativas.

- Não precisam de servidor central para ordenar: ótimo para offline e peer-to-peer.
- Custam mais memória (metadados por caractere) e exigem coleta de lixo das lápides (tombstones).
- Bibliotecas maduras: Yjs, Automerge.

## Arquitetura comum

1. Clientes se conectam por WebSocket ao servidor de sessão do documento.
2. O servidor valida, ordena (OT) ou apenas retransmite (CRDT) as operações.
3. Um log de operações é persistido; snapshots periódicos aceleram a abertura.
4. Presença e cursores trafegam no mesmo canal, mas são efêmeros.

## Como escolher

OT quando há um servidor autoritativo e edição majoritariamente online. CRDT quando offline e múltiplas réplicas são requisitos centrais.
