import type { Article } from '../types/entities';

export const articleCategories = ['Fundamentos', 'Caching', 'Dados', 'Mensageria', 'Tempo real', 'Confiabilidade', 'Padrões'] as const;

const coreArticleData: Omit<Article, 'source'>[] = [
  {
    slug: 'back-of-envelope', title: 'Estimativas de guardanapo', category: 'Fundamentos', readingMinutes: 7,
    summary: 'Transforme DAU e retenção em RPS, armazenamento e banda antes de desenhar a primeira caixa.',
    relatedProblems: ['url-shortener', 'metrics-monitoring', 'twitter-feed'],
    body: `Antes de escolher tecnologia, descubra a ordem de grandeza do problema. Um entrevistador quer ver que você sabe **por que** precisa de um cache, não só que caches existem.

## Números para decorar

- 1 dia ≈ 86.400 s ≈ **10⁵ s** (arredonde sem culpa)
- 1M req/dia ≈ **12 req/s** em média
- Pico ≈ **2–10×** a média, dependendo do produto
- Leitura em memória: ~100 ns · SSD: ~100 µs · round-trip no mesmo datacenter: ~0,5 ms · entre continentes: ~150 ms

## Roteiro

1. **Tráfego**: DAU × ações por usuário ÷ 10⁵ = RPS médio. Multiplique pelo fator de pico.
2. **Proporção leitura:escrita**: define se o foco é cache/réplicas (leitura) ou particionamento/filas (escrita).
3. **Armazenamento**: escritas/dia × tamanho do registro × retenção. Inclua réplicas (×3).
4. **Banda**: RPS × tamanho da resposta.

## Exemplo: encurtador de URL

100M links novos/mês ≈ 40 escritas/s. Com 100:1 de leitura, ≈ 4.000 leituras/s, pico de ~20k. Cada registro tem ~500 bytes: 100M × 12 × 5 anos × 500 B ≈ **3 TB**. Conclusão: cabe em um cluster modesto de KV store; o desafio real é latência de leitura e hot keys, não volume.

> Mostre as contas em voz alta e arredonde agressivamente. Precisão de 10% não muda a arquitetura; ordem de grandeza muda.`,
  },
  {
    slug: 'scalability', title: 'Escalabilidade horizontal e serviços stateless', category: 'Fundamentos', readingMinutes: 6,
    summary: 'Por que escalar para fora vence escalar para cima — e o que precisa mudar no código para isso funcionar.',
    relatedProblems: ['url-shortener', 'pastebin', 'leaderboard'],
    body: `**Escalar verticalmente** (máquina maior) é simples, mas tem teto e é um ponto único de falha. **Escalar horizontalmente** (mais máquinas) não tem teto prático, mas exige que qualquer instância consiga atender qualquer requisição.

## Stateless é o pré-requisito

Um serviço stateless não guarda nada entre requisições na memória local. Sessão, carrinho, progresso de upload: tudo vai para um armazenamento compartilhado (cache, banco, object storage). Assim o load balancer pode mandar cada requisição para qualquer réplica e você adiciona ou remove instâncias sem migrar estado.

## Onde o estado vai parar

- **Sessões e contadores quentes** → cache distribuído (Redis)
- **Dados de negócio** → banco de dados (replicado e, se preciso, particionado)
- **Arquivos** → object storage

## Autoscaling

Métricas como CPU, latência p99 ou tamanho de fila disparam novas réplicas. Lembre do **tempo de aquecimento**: se a instância leva 2 minutos para subir, um pico de 30 s ainda vai doer. Mantenha folga (headroom) de 30–50%.

## No canvas

Aumente o número de **réplicas** de um componente no inspetor. O Chaos Lab usa isso: perder 1 de 3 réplicas degrada; perder 1 de 1 derruba.`,
  },
  {
    slug: 'load-balancing', title: 'Load balancing', category: 'Fundamentos', readingMinutes: 6,
    summary: 'L4 vs L7, algoritmos de distribuição, health checks e como o próprio balanceador não vira SPOF.',
    relatedProblems: ['url-shortener', 'chat', 'ticketmaster'],
    body: `Um load balancer distribui requisições entre réplicas saudáveis e é o que torna a escala horizontal transparente para o cliente.

## L4 vs L7

- **L4 (TCP/UDP)**: rápido, não olha o conteúdo. Bom para conexões longas (WebSocket) e altíssimo throughput.
- **L7 (HTTP)**: roteia por caminho, header ou cookie; termina TLS; faz retries. É o que um API Gateway faz.

## Algoritmos

- **Round robin**: simples; ruim quando requisições têm custo muito diferente.
- **Least connections**: melhor para conexões longas.
- **Hash consistente** (por usuário ou chave): mantém afinidade — útil para caches locais e servidores de chat.

## Health checks

O balanceador remove réplicas que falham no health check. Cuidado com checks profundos demais: se o health check consulta o banco e o banco oscila, **todas** as réplicas saem do pool ao mesmo tempo.

## Evitando o SPOF

O balanceador em si roda em pares (ativo-ativo ou ativo-passivo com IP flutuante), e o DNS pode apontar para múltiplos balanceadores em zonas diferentes. Na nuvem, o LB gerenciado já é redundante — mas diga isso explicitamente na entrevista.`,
  },
  {
    slug: 'caching', title: 'Caching: estratégias, invalidação e stampedes', category: 'Caching', readingMinutes: 9,
    summary: 'Cache-aside, write-through, TTL, hot keys e o que acontece com o banco quando o cache cai.',
    relatedProblems: ['url-shortener', 'twitter-feed', 'leaderboard', 'distributed-cache'],
    body: `Cache troca consistência por latência e capacidade. Uma taxa de acerto de 80% significa que o banco recebe **5× menos** leituras.

## Estratégias

- **Cache-aside (lazy loading)**: a aplicação lê do cache; em miss, lê do banco e popula. Mais comum. Dado só entra no cache quando é pedido.
- **Write-through**: toda escrita atualiza banco e cache. Leituras sempre quentes; escritas mais lentas.
- **Write-behind**: escreve no cache e persiste depois, de forma assíncrona. Rápido, mas arrisca perda de dados.

## Invalidação

"Só existem duas coisas difíceis em computação…". Opções práticas:

- **TTL** curto para dados que podem ficar um pouco desatualizados.
- **Delete on write**: ao atualizar o banco, apague a chave (não atualize — evita corrida entre escritores).
- **Versionamento de chave**: \`user:42:v7\`; mudar a versão invalida tudo de uma vez.

## Hot keys

Um link viral pode concentrar 50% do tráfego em uma chave, ou seja, em um único nó do cache. Mitigações: cache local em processo (L1) com TTL de segundos, replicar a chave quente em N nós (\`key#1..key#N\`), ou CDN na frente.

## Cache stampede

Quando uma chave popular expira — ou o cache inteiro cai — milhares de requisições batem no banco ao mesmo tempo. Use **request coalescing** (só uma requisição recalcula), **TTL com jitter** e **stale-while-revalidate**.

> No Chaos Lab, derrube o Cache e observe a carga do banco subir 5×. Se o banco não aguentar, seu cache não é uma otimização — é uma dependência crítica.`,
  },
  {
    slug: 'cdn', title: 'CDN e cache na borda', category: 'Caching', readingMinutes: 5,
    summary: 'Como servir bytes perto do usuário e o que realmente dá para cachear na borda.',
    relatedProblems: ['video-streaming', 'autocomplete', 'ticketmaster'],
    body: `Uma CDN mantém cópias do conteúdo em centenas de pontos de presença (PoPs). O usuário em Recife baixa o vídeo de um servidor em Fortaleza, não da Virgínia.

## O que cachear

- **Estático**: JS, CSS, imagens, segmentos de vídeo — TTL longo, nome de arquivo com hash.
- **Semi-dinâmico**: página de evento, mapa de assentos, sugestões de autocomplete para prefixos curtos — TTL de segundos já elimina a maior parte da carga.
- **Personalizado**: em geral não; use cache na aplicação.

## Push vs pull

- **Pull**: a CDN busca na origem no primeiro miss. Simples, padrão.
- **Push**: você publica o conteúdo na CDN antes. Útil para lançamentos previsíveis (um trailer à meia-noite).

## Proteção da origem

Com **origin shield**, os PoPs consultam uma camada intermediária em vez da origem, reduzindo os misses que chegam ao seu serviço. CDNs também absorvem DDoS e terminam TLS perto do usuário.

## Invalidação

Prefira URLs versionadas (\`app.3f9a.js\`) a purgar o cache — purgas levam segundos ou minutos para propagar.`,
  },
  {
    slug: 'sql-vs-nosql', title: 'SQL vs NoSQL: escolhendo o banco', category: 'Dados', readingMinutes: 8,
    summary: 'Modelo de dados, padrões de acesso e garantias de consistência guiam a escolha — não o hype.',
    relatedProblems: ['payment-system', 'chat', 'video-streaming', 'url-shortener'],
    body: `A pergunta certa não é "SQL ou NoSQL?", é "quais são meus padrões de acesso e quais garantias preciso?".

## Relacional (PostgreSQL, MySQL)

- Transações ACID, joins, constraints (unicidade, chaves estrangeiras).
- Ótimo para dinheiro, estoque, reservas — onde a integridade importa mais que escala infinita.
- Escala leitura com réplicas; escala escrita com particionamento (mais trabalhoso).

## Key-value / wide-column (DynamoDB, Cassandra)

- Acesso por chave em latência previsível em qualquer escala.
- Você modela pela consulta: uma tabela por padrão de acesso, dados desnormalizados.
- Ideal para mensagens de chat (\`conversation_id\` + \`seq\`), timelines, sessões, URLs curtas.

## Documento (MongoDB)

- Agregados flexíveis lidos inteiros (perfil, catálogo de produto).

## Time-series, busca, grafo

Workloads especializados merecem bancos especializados: TSDB para métricas, índice invertido para busca, grafo para recomendações por relacionamento.

## Heurística de entrevista

1. Liste as 3 consultas mais frequentes.
2. Precisa de transação multi-registro? → relacional.
3. Escrita massiva com acesso por chave? → KV/wide-column.
4. É comum usar **os dois**: pagamentos em Postgres, eventos de auditoria em um log, cache em Redis.`,
  },
  {
    slug: 'sharding', title: 'Particionamento, sharding e hashing consistente', category: 'Dados', readingMinutes: 9,
    summary: 'Como dividir dados entre nós, escolher a chave de partição e rebalancear sem parar o mundo.',
    relatedProblems: ['twitter-feed', 'distributed-cache', 'leaderboard', 'ride-sharing'],
    body: `Quando um nó não comporta os dados ou as escritas, você divide o conjunto em **shards**, cada um responsável por uma parte das chaves.

## Estratégias

- **Por intervalo** (A–F, G–M…): consultas por faixa são eficientes, mas faixas populares viram hotspots.
- **Por hash**: \`hash(key) mod N\` distribui bem, mas mudar N remapeia quase tudo.
- **Hash consistente**: chaves e nós ficam em um anel; cada chave vai para o próximo nó no sentido horário. Adicionar um nó move só ~1/N das chaves. Com **nós virtuais**, a carga fica uniforme.
- **Diretório**: um serviço de lookup mapeia chave → shard. Flexível, mas é mais uma peça para manter disponível.

## Escolhendo a chave

Uma boa chave de partição tem alta cardinalidade e acesso uniforme, e mantém junto o que é consultado junto.

- Timeline: \`user_id\` (leituras de um usuário em um shard).
- Chat: \`conversation_id\` (ordenação local à partição).
- Cuidado com celebridades: um \`user_id\` com 100M seguidores vira hotspot. Divida com sufixos ou trate como caso especial.

## Os custos

Consultas entre shards (scatter-gather), transações distribuídas e rebalanceamento. Adie o sharding enquanto réplicas de leitura e cache resolverem — mas tenha a chave planejada.`,
  },
  {
    slug: 'replication-consistency', title: 'Replicação e modelos de consistência', category: 'Dados', readingMinutes: 9,
    summary: 'Líder-seguidor, multi-líder, quóruns, CAP/PACELC e quando consistência eventual basta.',
    relatedProblems: ['payment-system', 'ticketmaster', 'file-sync', 'rate-limiter'],
    body: `Replicar dá disponibilidade e capacidade de leitura. O preço é decidir o que acontece quando réplicas discordam.

## Topologias

- **Líder único**: escritas no líder, leituras em qualquer réplica. Simples; réplicas podem estar atrasadas (replication lag).
- **Multi-líder**: escritas em várias regiões; exige resolução de conflitos.
- **Sem líder (Dynamo)**: escreve em W réplicas e lê de R. Se **W + R > N**, a leitura enxerga a última escrita.

## Síncrona vs assíncrona

Replicação síncrona não perde dados quando o líder cai, mas cada escrita espera a réplica. Um meio-termo comum: uma réplica síncrona e as demais assíncronas.

## CAP e PACELC

Durante uma **P**artição, escolha **C**onsistência ou **A**disponibilidade. **E**lse (sem partição), escolha **L**atência ou **C**onsistência. Na prática, a pergunta é por funcionalidade:

- Saldo, assento, estoque → consistência forte (rejeite em vez de errar).
- Contagem de curtidas, presença, feed → consistência eventual.

## Garantias úteis

- **Read-your-writes**: após editar o perfil, o usuário vê a edição (leia do líder por alguns segundos).
- **Leituras monotônicas**: o usuário nunca "volta no tempo" (fixe-o em uma réplica).

> Em entrevistas, diga explicitamente qual garantia cada fluxo precisa. É isso que o juiz rigoroso procura.`,
  },
  {
    slug: 'message-queues', title: 'Filas de mensagens e processamento assíncrono', category: 'Mensageria', readingMinutes: 8,
    summary: 'Desacoplar produtores e consumidores, absorver picos e reprocessar falhas com segurança.',
    relatedProblems: ['notification-service', 'video-streaming', 'web-crawler', 'payment-system'],
    body: `Uma fila deixa o produtor responder rápido ("recebido") enquanto workers fazem o trabalho pesado no seu próprio ritmo.

## Quando usar

- Trabalho lento ou não essencial à resposta: e-mail, transcodificação, thumbnails, analytics.
- **Absorver picos**: a fila cresce durante o pico e esvazia depois, em vez de derrubar o banco.
- Integrações instáveis: provedores externos podem cair sem perder pedidos.

## Semânticas de entrega

- **At-most-once**: pode perder; nunca duplica.
- **At-least-once**: nunca perde; pode duplicar. O padrão na prática → **consumidores idempotentes**.
- **Exactly-once**: na prática, at-least-once + deduplicação.

## Retries e DLQ

Reprocesse com **backoff exponencial e jitter**. Após N tentativas, mova para uma **dead-letter queue** para inspeção, para que uma mensagem envenenada não bloqueie a fila.

## Prioridade e isolamento

Filas separadas por prioridade (OTP vs marketing) e por tenant evitam que um lote gigante atrase o que é crítico.

## Backpressure

Monitore a **idade da mensagem mais antiga**, não só o tamanho da fila. Escale consumidores por essa métrica.

> No canvas, marque conexões assíncronas. No Chaos Lab, um pico de tráfego aparece como backlog crescente na fila — o sistema degrada, mas não cai.`,
  },
  {
    slug: 'event-streaming', title: 'Event streaming e logs particionados', category: 'Mensageria', readingMinutes: 7,
    summary: 'Kafka e companhia: logs imutáveis, partições, consumer groups e replay.',
    relatedProblems: ['metrics-monitoring', 'ride-sharing', 'autocomplete'],
    body: `Um log de eventos (Kafka, Kinesis, Pulsar) é uma fila que **não apaga** a mensagem ao consumi-la. Cada consumidor guarda seu próprio offset.

## Por que isso importa

- **Vários consumidores** independentes leem o mesmo fluxo: indexação, analytics, alertas.
- **Replay**: um bug no consumidor? Corrija e reprocesse desde o offset de ontem.
- **Ordenação por partição**: eventos com a mesma chave (ex.: \`driver_id\`) caem na mesma partição e chegam em ordem.

## Partições e paralelismo

O paralelismo máximo de um consumer group é o número de partições. Escolha uma chave que distribua bem e preserve a ordem onde ela importa.

## Padrões

- **Event sourcing**: o log é a fonte da verdade; o estado é uma projeção.
- **CDC (change data capture)**: o log de commits do banco vira um stream para alimentar caches, buscas e data warehouse — sem dual-write.
- **Agregação em janela**: contagens por minuto para métricas, ranking de buscas, preços dinâmicos.

## Fila ou stream?

Fila para **tarefas** (cada mensagem é processada uma vez por um worker). Stream para **fatos** (eventos que vários sistemas querem ouvir, com retenção).`,
  },
  {
    slug: 'rate-limiting', title: 'Rate limiting', category: 'Padrões', readingMinutes: 7,
    summary: 'Token bucket, janelas deslizantes e como aplicar limites globais em uma frota distribuída.',
    relatedProblems: ['rate-limiter', 'notification-service', 'web-crawler', 'ticketmaster'],
    body: `Rate limiting protege seus serviços de abuso, garante uso justo entre clientes e controla custo com provedores externos.

## Algoritmos

- **Token bucket**: o balde ganha R tokens/s até a capacidade B; cada requisição consome um. Permite rajadas de até B. É o mais usado.
- **Leaky bucket**: fila com vazão constante — suaviza o tráfego.
- **Janela fixa**: contador por minuto. Simples, mas permite 2× o limite na virada da janela.
- **Janela deslizante (contador)**: pondera a janela anterior. Ótimo custo-benefício.

## Distribuído

Com 50 gateways, contadores locais não bastam. Opções:

1. **Redis central** com operação atômica (\`INCR\` + \`EXPIRE\` ou script Lua). Adiciona ~1 ms.
2. **Contadores locais + sincronização periódica**: tolera pequeno estouro em troca de latência zero.
3. **Sticky routing** por chave de API para um subconjunto de nós.

## Fail-open vs fail-closed

Se o Redis do limiter cair, você bloqueia tudo (fail-closed) ou deixa passar (fail-open)? Para APIs públicas, geralmente fail-open com limite local de emergência. Diga isso explicitamente.

## Resposta

HTTP **429** com \`Retry-After\` e headers \`X-RateLimit-Remaining\`. Clientes bem-comportados fazem backoff.`,
  },
  {
    slug: 'realtime', title: 'Comunicação em tempo real', category: 'Tempo real', readingMinutes: 8,
    summary: 'Polling, long polling, SSE e WebSockets — e como rotear mensagens para a conexão certa.',
    relatedProblems: ['chat', 'ride-sharing', 'file-sync'],
    body: `HTTP tradicional é o cliente que pergunta. Tempo real exige que o servidor consiga **empurrar** dados.

## Opções

- **Short polling**: pergunta a cada N segundos. Simples, desperdiça recursos.
- **Long polling**: o servidor segura a requisição até ter algo. Funciona em qualquer lugar.
- **SSE (Server-Sent Events)**: fluxo unidirecional servidor → cliente sobre HTTP. Ótimo para feeds e notificações.
- **WebSocket**: canal bidirecional persistente. Padrão para chat, jogos e localização ao vivo.

## O problema do roteamento

Com milhões de conexões espalhadas em centenas de servidores WebSocket, como a mensagem de Ana chega ao servidor onde Bruno está conectado?

1. Um **registro de conexões** (Redis: \`user_id → gateway_id\`) atualizado na conexão e desconexão.
2. O serviço de chat consulta o registro e publica para aquele gateway (pub/sub ou RPC direto).
3. Se o usuário está offline: persiste e envia **push notification**.

## Presença

Heartbeats a cada ~30 s com TTL no registro. Presença é naturalmente eventual — não gaste consistência forte nela.

## Escala de conexões

Cada conexão ocupa memória e um file descriptor. Servidores dedicados a conexões (gateways) separados da lógica de negócio permitem escalar cada parte de forma independente e fazer deploy sem derrubar todo mundo.`,
  },
  {
    slug: 'fan-out-feeds', title: 'Fan-out e feeds', category: 'Padrões', readingMinutes: 8,
    summary: 'Push vs pull para timelines, o problema das celebridades e o modelo híbrido.',
    relatedProblems: ['twitter-feed', 'notification-service'],
    body: `Montar uma timeline é juntar posts recentes de todas as contas que um usuário segue. Existem duas abordagens extremas.

## Fan-out na escrita (push)

Ao publicar, um worker insere o ID do post na timeline pré-computada de **cada seguidor** (lista em cache, limitada a ~800 itens).

- Leitura: O(1) — basta ler a lista.
- Escrita: O(seguidores). Uma celebridade com 100M seguidores gera 100M escritas por post.

## Fan-out na leitura (pull)

Ao abrir o app, busca os posts recentes de cada conta seguida e mescla.

- Escrita: barata.
- Leitura: cara e lenta para quem segue milhares de contas.

## Híbrido

- Contas normais: push.
- Celebridades (acima de um limite de seguidores): pull na hora da leitura, mesclado com a timeline pré-computada.
- Usuários inativos: não recebem push; a timeline é reconstruída quando voltarem.

## Detalhes que impressionam

- O fan-out roda **assíncrono** via fila; o post aparece para o autor imediatamente.
- Armazene só IDs na timeline; hidrate os posts com um multi-get em cache.
- Ranqueamento (não cronológico) entra como uma etapa depois da coleta de candidatos.`,
  },
  {
    slug: 'idempotency', title: 'Idempotência e exactly-once', category: 'Confiabilidade', readingMinutes: 8,
    summary: 'Chaves de idempotência, outbox transacional e como nunca cobrar duas vezes.',
    relatedProblems: ['payment-system', 'notification-service', 'chat'],
    body: `Redes falham no pior momento: o servidor processou, mas a resposta se perdeu. O cliente tenta de novo. Sem idempotência, o cliente é cobrado duas vezes.

## Chave de idempotência

O cliente gera um UUID por intenção ("pagar o pedido 123") e o envia em toda tentativa.

1. Em uma transação, insira \`(idempotency_key, status = 'processing')\` com **constraint única**.
2. Se a inserção falhar porque a chave já existe, devolva o resultado salvo (ou "em andamento").
3. Processe; salve o resultado junto da chave.

## Dual write e outbox

"Atualizar o banco **e** publicar um evento" não é atômico. Se o processo cair entre os dois, os sistemas divergem. **Transactional outbox**: grave o evento numa tabela \`outbox\` na mesma transação; um relay publica e marca como enviado. Consumidores deduplicam pelo ID do evento.

## Exactly-once na prática

Entrega at-least-once + processamento idempotente = efeito exactly-once.

## Desfechos desconhecidos

Chamou o provedor de pagamento e deu timeout? O estado é **desconhecido**, não "falhou". Consulte o status pela sua chave de idempotência ou deixe a reconciliação resolver — nunca simplesmente tente de novo com uma chave nova.`,
  },
  {
    slug: 'resilience-patterns', title: 'Padrões de resiliência', category: 'Confiabilidade', readingMinutes: 8,
    summary: 'Timeouts, retries com jitter, circuit breakers, bulkheads e degradação graciosa.',
    relatedProblems: ['notification-service', 'payment-system', 'rate-limiter'],
    body: `Em sistemas distribuídos, falha parcial é o estado normal. O objetivo é que uma dependência lenta não derrube tudo em cascata.

## Timeouts

Toda chamada de rede precisa de timeout. Sem ele, threads ficam presas esperando, o pool esgota e o serviço inteiro para por causa de uma dependência lenta.

## Retries

- Só para operações **idempotentes**.
- **Backoff exponencial com jitter** — senão todos os clientes tentam de novo no mesmo milissegundo.
- **Retry budget**: limite retries a ~10% do tráfego para não amplificar uma falha.

## Circuit breaker

Após X% de falhas, o circuito "abre" e as chamadas falham imediatamente (ou usam fallback) por um tempo. Depois, algumas requisições de teste decidem se ele fecha. Protege a dependência e o chamador.

## Bulkheads

Isole recursos (pools de conexão, filas, réplicas) por dependência ou por tipo de cliente. Um provedor de SMS lento não deve consumir as threads do fluxo de login.

## Degradação graciosa

Defina o que o sistema faz quando algo cai:

- Sem cache → serve do banco com limite de taxa.
- Sem serviço de recomendação → mostra os populares.
- Sem busca → esconde a caixa de busca, mantém o checkout.

> No canvas, componentes como Cache, CDN e Search são **dependências soft**: o Chaos Lab marca o chamador como degradado, não como falho, quando eles caem.`,
  },
  {
    slug: 'geospatial', title: 'Indexação geoespacial', category: 'Padrões', readingMinutes: 7,
    summary: 'Geohash, quadtrees e células H3/S2 para responder "o que está perto de mim?" em milissegundos.',
    relatedProblems: ['ride-sharing'],
    body: `"Motoristas num raio de 2 km" não dá para responder com um \`WHERE\` em latitude e longitude em escala — índices B-tree trabalham em uma dimensão.

## Geohash

Codifica (lat, lng) em uma string em que **prefixos comuns indicam proximidade**: \`6gyf4\` é uma célula de ~5 km; \`6gyf4b\`, uma subcélula. Busca de vizinhos = consultar a célula do usuário e as 8 adjacentes. Funciona em qualquer KV store ou com Redis GEO.

## Quadtree

Divide o mapa recursivamente em 4 quadrantes até cada folha ter no máximo N pontos. Adapta-se à densidade (Manhattan tem folhas pequenas, o deserto tem folhas grandes). Normalmente fica em memória.

## H3 / S2

Hierarquias de células (hexágonos no H3) usadas por Uber e Google. Hexágonos têm vizinhos equidistantes, o que facilita raios e agregações (oferta e demanda por célula para preço dinâmico).

## Arquitetura típica para ride sharing

1. Motoristas enviam localização a cada 4 s → gateway WebSocket → stream.
2. Um serviço de localização mantém \`cell → set(driver_id)\` em memória (Redis), com TTL.
3. A busca consulta as células vizinhas, filtra por disponibilidade e ordena por ETA.
4. O histórico de posições vai para armazenamento frio (analytics, auditoria).

Particione por região ou cidade: a maior parte das consultas é local.`,
  },
  {
    slug: 'id-generation', title: 'Geração de IDs únicos', category: 'Padrões', readingMinutes: 6,
    summary: 'Auto-incremento, UUID, Snowflake e base62 para aliases curtos.',
    relatedProblems: ['url-shortener', 'pastebin', 'chat'],
    body: `IDs parecem triviais até você precisar gerá-los em 100 servidores sem coordenação.

## Opções

- **Auto-incremento do banco**: simples e ordenado, mas é um gargalo e um ponto único de falha.
- **UUID v4**: 128 bits aleatórios, sem coordenação. Grande e sem ordem, o que fragmenta índices.
- **UUID v7 / ULID**: prefixo de timestamp + aleatório. Ordenável e sem coordenação. Ótimo padrão moderno.
- **Snowflake** (64 bits): timestamp (41) + máquina (10) + sequência (12). Ordenado por tempo e compacto; exige atribuir IDs de máquina.
- **Faixas pré-alocadas**: um serviço entrega blocos de 1.000 IDs para cada servidor.

## Aliases curtos (encurtador)

7 caracteres em base62 = 62⁷ ≈ **3,5 trilhões** de combinações.

- **Contador + base62**: sem colisões, mas previsível (dá para enumerar links). Embaralhe com uma permutação bijetiva.
- **Hash da URL (MD5/SHA) truncado**: determinístico (a mesma URL gera o mesmo alias), mas exige checar colisões.
- **Aleatório + verificação**: insert condicional; em colisão, gera outro.

Para aliases personalizados, use uma constraint de unicidade e trate o conflito como erro do usuário.`,
  },
  {
    slug: 'object-storage-media', title: 'Object storage e pipelines de mídia', category: 'Dados', readingMinutes: 7,
    summary: 'URLs pré-assinadas, uploads multipart, chunking e transcodificação em escala.',
    relatedProblems: ['video-streaming', 'file-sync', 'pastebin', 'web-crawler'],
    body: `Object storage (S3, Azure Blob, GCS) guarda bytes de forma barata, durável (11 noves) e praticamente ilimitada. Não coloque arquivos grandes no banco.

## Upload direto

O cliente pede ao seu serviço uma **URL pré-assinada** e envia o arquivo direto ao storage. Seus servidores não carregam gigabytes. Para arquivos grandes, use **multipart upload**: partes de 5–100 MB, retomáveis e em paralelo.

## Chunking com endereçamento por conteúdo

Divida arquivos em blocos de ~4 MB e use o hash do bloco como chave:

- Deduplicação gratuita (o mesmo bloco é armazenado uma vez).
- Sincronização incremental: só os blocos alterados trafegam.
- Metadados no banco: \`file_version → [hash1, hash2, …]\`.

## Pipeline de vídeo

1. Upload concluído → evento na fila.
2. Workers dividem o vídeo em segmentos e transcodificam em paralelo (1080p, 720p, 480p…).
3. Gera manifesto HLS/DASH; segmentos vão para o storage.
4. A CDN serve segmentos; o player alterna a qualidade conforme a banda.

## Classes de armazenamento

Dados quentes em storage padrão; a cauda longa (vídeos pouco vistos, versões antigas) migra para camadas frias por política de ciclo de vida — redução de custo de 50–80%.`,
  },
  {
    slug: 'search', title: 'Busca e índices invertidos', category: 'Dados', readingMinutes: 6,
    summary: 'Como funciona um índice invertido, indexação assíncrona e por que o banco principal não é o motor de busca.',
    relatedProblems: ['autocomplete', 'web-crawler', 'video-streaming'],
    body: `\`LIKE '%termo%'\` faz varredura completa. Busca de verdade usa um **índice invertido**: para cada termo, a lista de documentos que o contêm.

## Indexação

1. **Tokenização**: separar palavras, normalizar caixa e acentos, aplicar stemming ("correndo" → "corr").
2. **Postings**: \`termo → [(doc_id, posições, frequência)]\`.
3. **Ranqueamento**: BM25 + sinais de negócio (popularidade, recência).

## Arquitetura

- O banco principal é a fonte da verdade; o índice de busca é uma **projeção**.
- Mudanças fluem por CDC ou eventos → indexador → Elasticsearch/OpenSearch. A busca fica alguns segundos atrás, e isso costuma ser aceitável.
- O índice é particionado por documento; cada consulta vai a todos os shards e os resultados são mesclados.

## Autocomplete é diferente

Para sugestões por prefixo com latência abaixo de 50 ms, use uma **trie** (ou um mapa prefixo → top-k) pré-computada a partir dos logs de consulta e carregada em memória. Busca full-text completa seria lenta e cara demais para cada tecla digitada.`,
  },
  {
    slug: 'observability-chaos', title: 'Observabilidade e chaos engineering', category: 'Confiabilidade', readingMinutes: 7,
    summary: 'Métricas, logs e traces; SLOs; e como injetar falhas de propósito para provar que o design aguenta.',
    relatedProblems: ['metrics-monitoring', 'notification-service', 'payment-system'],
    body: `Você não consegue operar o que não consegue ver — e não confia em redundância que nunca foi testada.

## Os três pilares

- **Métricas**: séries temporais agregadas (RPS, erros, latência p50/p99, saturação). Baratas; base para alertas.
- **Logs**: eventos detalhados e estruturados (JSON) para investigação.
- **Traces**: o caminho de uma requisição entre serviços. Mostram onde o tempo foi gasto.

## SLIs, SLOs e error budgets

- **SLI**: o que você mede (porcentagem de redirects com sucesso abaixo de 100 ms).
- **SLO**: a meta (99,9% em 30 dias).
- **Error budget**: 0,1% de falhas "permitidas". Orçamento estourado? Congela features e prioriza confiabilidade.

Alerte sobre **sintomas** que o usuário sente (taxa de erro, latência), não sobre causas (CPU alta).

## Chaos engineering

1. Defina o **estado estável** (métricas normais).
2. Formule uma hipótese: "se um nó do cache cair, o p99 continua abaixo de 150 ms".
3. Injete a falha em escopo controlado.
4. Compare com o estado estável; corrija o que quebrou.

O Chaos Lab deste app aplica a mesma ideia ao seu desenho: derrube componentes, corte conexões e multiplique o tráfego para encontrar pontos únicos de falha **antes** do entrevistador.`,
  },
];

/** Built-in articles. Installed hub packs are merged on top of these by `buildCatalog`. */
export const articles: Article[] = coreArticleData.map((article) => ({ ...article, source: null }));
