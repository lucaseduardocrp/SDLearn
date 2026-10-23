---
title: Consenso, eleição de líder e leases
category: Confiabilidade
summary: Como vários nós concordam sobre quem manda — Raft, quóruns, leases e fencing tokens.
readingMinutes: 8
relatedProblems: [job-scheduler, distributed-cache]
---
Muitos sistemas precisam que **exatamente um** nó faça algo: o líder de uma partição, o dono de um job, o primário de um banco. Em uma rede que perde mensagens e nós que pausam, isso exige consenso.

## Raft em uma página

- Cada nó é **seguidor**, **candidato** ou **líder**.
- Sem heartbeat do líder, um seguidor vira candidato e pede votos. Quem recebe a **maioria** vira líder daquele **termo**.
- O líder replica um log; uma entrada está **confirmada** quando a maioria a gravou.
- Com 5 nós, o cluster tolera 2 falhas. Com 2 nós, não tolera nenhuma: use números ímpares.

Na prática você raramente implementa Raft: usa etcd, ZooKeeper ou Consul, ou um banco que já resolve isso internamente.

## Leases

Um **lease** é uma posse com prazo: "o worker 7 é dono do job 42 até 10:00:30". Se o worker morrer, o lease expira e outro assume. Renove antes de expirar.

O perigo: o worker 7 pausa (GC, rede) e continua achando que é dono depois que o lease expirou. Dois donos ao mesmo tempo.

## Fencing tokens

Cada novo lease recebe um número crescente. Todo efeito colateral envia o token, e o recurso rejeita tokens menores que o último visto. O dono "zumbi" com o token 33 é recusado porque o novo dono já escreveu com o 34.

## Na entrevista

- Diga quem decide a posse (serviço de coordenação ou update condicional no banco).
- Diga o que acontece quando o dono some (expiração) e quando ele volta (fencing).
- Lembre que consenso custa latência: use-o para metadados e posse, não em cada requisição.
