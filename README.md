# FOR HONOR · Eventos do Clã

Site do clã **FOR HONOR** para confirmar presença nos eventos semanais do Diablo Immortal.

🌐 **Acesse:** https://forhonorcla.com.br

O nome e o lema aparecem no topo e na tela de login, e podem ser trocados no [`config.js`](config.js).

- Membros entram com a **conta Google** e respondem **Vou / Não vou** em cada evento.
- Ao confirmar presença, o membro também informa se vai usar o **Discord** no evento. Oficiais veem um 🎧 ao lado de quem vai estar no Discord: nas listas, no painel de times (com a contagem por time) e nos textos copiados.
- Membros comuns **não veem as respostas dos outros**: nem as listas "Vão / Não vão / Sem resposta" nem os contadores dos eventos. Só oficiais e o líder veem.
- Cada membro cadastra **classe** (DH, Cruzado, Mago, BK, Monge, Druida, Bárbaro, Necromante, Bruxo, Tempest), os **atributos** (Armadura, Perfurar Armadura, Potência, Resistência, Ressonância) e, se quiser, um **telefone**. Ao clicar em "Vou", o membro confirma ou corrige a classe e os atributos.
- **Líder e oficiais** criam, editam, repetem e apagam eventos, e aprovam novos membros.
- **Montagem de times** com quem confirmou presença: formato **Guerra** (12 times de 8: Exaltação, Eminência, Renome e Orgulho, de 1 a 3 cada) ou **Rito** (até 10 times de 8).
- **Frequência**: depois do evento, um oficial marca quem realmente compareceu. O painel mostra a % de presença de cada membro, quem confirmou e faltou e quem não respondeu.
- Em cada evento aparece quem vai, quem não vai e quem ainda não respondeu. Os botões "Copiar lista" e "Copiar times" geram textos prontos para colar no Discord.
- **Recrutamentos**: membros procuram gente para um Grupo Guerreiro, um evento PvP ou outra atividade; os candidatos se inscrevem e quem criou escolhe quem entra.
- **Sorteio**: todo domingo às 22h (Brasília) o site sorteia prêmios entre os inscritos que tiveram presença registrada nas duas Guerras das Sombras da semana.
- **Central de Atendimento**: membros abrem tickets para a liderança (sugestões, dúvidas, problemas no site, denúncias), inclusive de forma anônima.
- **Configurações do líder**: o líder define o que os oficiais podem fazer sozinhos, o que precisa da aprovação dele e o que fica bloqueado.
- **Utils**: links úteis para o clã, como o Discord da aliança, builds, gemas e patch notes.

O site fica no **GitHub Pages**, com o domínio próprio `forhonorcla.com.br`, e os dados ficam no **Supabase** (plano free). Só o domínio é pago; o resto é gratuito.

> Abrindo o `index.html` sem configurar nada, o site roda em **modo demonstração**, com dados fictícios.

---

## Passo a passo (cerca de 20 minutos, feito uma única vez)

### 1. Criar o banco no Supabase
1. Crie uma conta em https://supabase.com e clique em **New project** (escolha a região *South America (São Paulo)*).
2. Quando o projeto estiver pronto, abra **SQL Editor**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** (ou **publishable**).

### 2. Criar as credenciais de login no Google
1. Acesse https://console.cloud.google.com e crie um projeto (dê o nome do clã).
2. Em **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform → Branding**), escolha o tipo **Externo**, preencha o nome do app (ex.: "FOR HONOR") e o e-mail de suporte, e salve. Em **Público-alvo**, clique em **Publicar app** para que qualquer conta Google possa entrar (sem isso, só os "usuários de teste" cadastrados conseguem).
3. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: o endereço do site (`https://forhonorcla.com.br`).
   - **URIs de redirecionamento autorizados**: `https://SEU-PROJETO.supabase.co/auth/v1/callback`
     (use a sua Project URL + `/auth/v1/callback`).
4. Clique em **Criar** e copie o **ID do cliente** e a **Chave secreta do cliente**.

### 3. Ligar o Google no Supabase
1. No Supabase: **Authentication → Sign In / Providers → Google**, ative e cole o Client ID e o Client Secret.

### 4. Publicar o site no GitHub Pages
1. Edite o [`config.js`](config.js): coloque o nome do clã, a Project URL e a chave anon.
2. Crie um repositório público no GitHub e envie os arquivos `index.html`, `app.js`, `styles.css` e `config.js`.
3. No repositório: **Settings → Pages → Branch: main / (root) → Save**. Em 1 ou 2 minutos o site estará em
   `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
4. No Supabase: **Authentication → URL Configuration**:
   - **Site URL**: `https://forhonorcla.com.br/`
   - **Redirect URLs**: adicione `https://forhonorcla.com.br/`

### Domínio próprio (`forhonorcla.com.br`)
O domínio está registrado no **registro.br** e aponta para o GitHub Pages. O endereço antigo (`https://clafhonor-collab.github.io/cadastro-cl-/`) e o `www` redirecionam sozinhos para `https://forhonorcla.com.br`.

- **DNS (registro.br → Configurar zona DNS):**

  | Tipo | Nome | Valor |
  |---|---|---|
  | A | *(em branco)* | 185.199.108.153 |
  | A | *(em branco)* | 185.199.109.153 |
  | A | *(em branco)* | 185.199.110.153 |
  | A | *(em branco)* | 185.199.111.153 |
  | CNAME | www | clafhonor-collab.github.io |

  No registro.br, o nome do domínio principal fica **em branco**; o painel não aceita `@`.
- **GitHub:** em **Settings → Pages → Custom domain** está `forhonorcla.com.br`, com **Enforce HTTPS** marcado. O arquivo [`CNAME`](CNAME) guarda o domínio; não apague.
- **Se trocar de domínio:** atualize o DNS, o Custom domain no GitHub, a Site URL e as Redirect URLs no Supabase e as Origens JavaScript no Google Cloud. O código não precisa mudar.

### 5. Tornar-se líder
1. Abra o site e entre com a sua conta Google. Você verá "Aguardando aprovação". Isso é esperado.
2. No Supabase, abra o **SQL Editor** e rode (trocando pelo nome da sua conta Google, como aparece no topo do site):
   ```sql
   update public.profiles set role = 'leader' where google_name = 'Seu Nome no Google';
   ```
3. Recarregue o site. Agora você é o líder: vá em **Membros** e promova os oficiais.

### 6. Convidar o clã
Mande o link https://forhonorcla.com.br no Discord do clã. Cada pessoa entra com a conta Google e aparece em **Membros → Aguardando aprovação**. Um oficial ou o líder clica em **Aprovar**.

---

## Permissões

| Ação | Membro | Oficial | Líder |
|---|:-:|:-:|:-:|
| Ver eventos e responder Vou/Não vou | ✔ | ✔ | ✔ |
| Editar o próprio perfil (personagem, classe, atributos, telefone) | ✔ | ✔ | ✔ |
| Ver o próprio time (sem médias/totais) | ✔ | ✔ | ✔ |
| Ver quem respondeu Vou / Não vou e quem vai estar no Discord | | ✔ | ✔ |
| Painel "Meu perfil" com a própria frequência | ✔ | ✔ | ✔ |
| Abrir o perfil de outro membro | | ✔ | ✔ |
| Sugerir times automaticamente | | ✔ | ✔ |
| Definir prazo, travar times e decidir pedidos de saída | | ✔ | ✔ |
| Pedir para sair depois do prazo ou com times travados | ✔ | | |
| Ler e escrever anotações internas (exceto sobre si mesmo) | | ✔ | ✔ |
| Ver todos os times, médias/totais e copiar times | | ✔ | ✔ |
| Ver a lista de membros e os telefones | | ✔ | ✔ |
| Criar / editar / apagar eventos | | ✔ | ✔ |
| Montar times | | ✔ | ✔ |
| Ver o histórico de alterações do evento e quem alterou cada sala por último | | ✔ | ✔ |
| Registrar presença real e ver a frequência | | ✔ | ✔ |
| Aprovar, recusar ou remover membros comuns | | ✔ | ✔ |
| Remover oficiais e readmitir ex-membros | | | ✔ |
| Promover a oficial ou líder | | | ✔ |
| Criar recrutamentos e se candidatar | ✔ | ✔ | ✔ |
| Aprovar recrutamentos (menos os próprios, no caso do oficial) | | ✔ | ✔ |
| Abrir tickets, inclusive anônimos | ✔ | ✔ | ✔ |
| Responder, assumir e resolver tickets de outros membros | | ✔ | ✔ |
| Ver quem abriu um ticket anônimo | | | ✔ |
| Inscrever-se no sorteio e retirar a inscrição | ✔ | ✔ | ✔ |
| Ativar (criar), editar e cancelar sorteios | | ✔ | ✔ |
| Ver o painel do sorteio (inscritos e elegíveis) e remover inscrições com motivo | | ✔ | ✔ |
| Definir as permissões dos oficiais e aprovar as solicitações deles | | | ✔ |

As funções marcadas para oficiais podem ser restringidas pelo líder em **⚙️ Configurações** (veja abaixo).
As regras ficam no próprio banco (Row Level Security), então ninguém consegue burlar alterando o site.

## Como usar no dia a dia

**Montar times** (oficial ou líder): abra o evento e clique em **⚔ Montar times**, depois escolha **Guerra** ou **Rito**.
À esquerda ficam os confirmados ainda sem time, que dá para ordenar por atributo ou filtrar por classe. Clique em um membro e depois no time, ou arraste. Para tirar alguém, clique no × ou arraste de volta para a lista.
As mudanças ficam num **rascunho**: quem foi movido ganha uma marca dourada, e a barra no topo mostra quantas alterações faltam salvar.
Clique em **💾 Salvar** para publicar os times, ou em **Descartar** para voltar ao que estava salvo. O site avisa se você tentar sair da página sem salvar.
Se outro oficial tiver salvado os mesmos times enquanto você editava, o site pergunta antes de substituir.
Cada time aceita no máximo 8 pessoas. O seletor **Média / Totalizador / Ocultar** troca entre a média e a soma dos 5 atributos de cada time. **Ocultar** mostra só o nome e a classe de cada membro; no painel de montagem, a lista "Sem time" continua com os atributos, para ajudar na escolha. Ele aparece no painel de montagem e também na seção "Times" da página do evento, só para oficiais e o líder. A escolha fica lembrada no seu navegador e vale para os dois lugares.

**✨ Sugerir times:** no painel de montagem, o botão monta uma sugestão usando a **Ressonância** como medida de força. Na Guerra há três modos:
- **Foco Exaltação:** os mais fortes preenchem Exaltação 1, 2 e 3; depois Eminência, Renome e Orgulho.
- **Foco 2/2:** Exaltação 1 e 2 com os mais fortes, Exaltação 3 vazia; Eminência 1 e 2 em seguida, Eminência 3 vazia; Renome e Orgulho completas.
- **Foco 1 Exaltação:** os mais fortes só na Exaltação 1, com Exaltação 2 e 3 vazias; Eminência, Renome e Orgulho completas.

Em todos os modos, os mais fortes vão para as salas mais altas, e as salas da mesma categoria (ex.: Eminência 1, 2 e 3) ficam com quantidade de membros e Ressonância total equilibradas.
No Rito há o modo **Equilibrado**, que distribui os confirmados em times completos de 8, com a Ressonância equilibrada.
A sugestão entra como **rascunho**: ajuste o que quiser e clique em **💾 Salvar**.

**⏳ Prazo para responder:** ao criar ou editar um evento, escolha até quando os membros podem responder (ex.: "2h antes", que é o padrão; ou "Sem prazo").
Os cards mostram "⏳ Responda até …". Depois do prazo, aparece "⛔ Respostas encerradas" e os membros não conseguem mais mudar a resposta.

**Próximos → Passados:** quando o evento começa, o card ganha o selo **Agora**. **20 minutos depois do horário de início**, o evento sai de **Próximos** e vai sozinho para **Passados**, mesmo com a página aberta.

**🔒 Travar times:** no painel de montagem, o botão **🔓 Travar times** trava os times. Com os times travados, quem está escalado não sai sozinho: o botão "Não vou" vira **"Não vou poder ir…"**, e o membro informa o motivo.
Quem não está escalado continua respondendo normalmente enquanto o prazo estiver aberto. Oficiais e o líder continuam podendo editar os times e mudar a própria resposta.

**⚠ Pedidos de saída:** os pedidos aparecem na página do evento para oficiais e o líder, com o nome, o time e o motivo.
- **Aceitar saída:** o membro passa para "Não vou" e sai do time.
- **Manter:** o membro continua confirmado.

O card do evento mostra "⚠ N pedido(s) de saída", e no painel de montagem o membro que pediu aparece com ⚠. O membro pode cancelar o próprio pedido enquanto o oficial não decide.

**📝 Anotações internas:** no perfil de um membro, oficiais e líder podem registrar observações (ex.: "troca de turno às quintas").
Só oficiais e o líder veem as anotações, e ninguém vê as anotações sobre si mesmo. Cada um apaga as próprias; o líder pode apagar qualquer uma. Na lista de Membros, o selo 📝 mostra quem tem anotações.

**Como o membro vê o próprio time:** depois que os times são salvos, o card do evento mostra o selo **"Seu time: …"**.
A página do evento mostra o aviso **"Você está no time …"** e **só o time dele**, com o nome e a classe de cada integrante, sem os atributos.
O membro não vê os outros times, nem as médias ou os totais, nem o botão "Copiar times". O banco também só entrega a ele os dados do próprio time.
O site não manda notificação; use **📋 Copiar times** para avisar no Discord.

**Meu perfil** (menu do topo, para todos: membros, oficiais e líder): é o painel individual de cada um.
Oficiais e líder também abrem o **perfil de qualquer membro**: basta clicar no membro na lista de **Membros** ou no nome dele na tabela de **Frequência**.
Nesse caso, o painel também mostra o telefone (se informado) e o botão "← Membros" para voltar, mas não tem "Editar perfil", porque cada um edita só o próprio.
Membros comuns não conseguem abrir o perfil de outra pessoa. O painel mostra:
- os dados do membro, com um botão para editar o perfil;
- a frequência no período escolhido, as presenças, a sequência atual de presenças e quantas vezes confirmou e faltou;
- os próximos eventos, com a resposta dada e o time, destacando os que ainda estão sem resposta;
- os 5 atributos comparados com a média do clã;
- os últimos eventos, com o resultado de cada um (presente, confirmou e faltou, avisou, faltou sem responder);
- o histórico das próprias alterações de nome, classe e atributos. Se alguém mudar a resposta para "Não vou", sai do time automaticamente.

**🕘 Histórico de alterações do evento** (oficiais e líder): na página do evento, o botão **🕘 Histórico de alterações** mostra quem mudou o quê, do mais recente para o mais antigo, com o nome, o cargo, a data e a hora:
- criação do evento e edições (nome, data, tipo, prazo para responder e descrição);
- formato dos times, times renomeados, times travados e destravados;
- cada sala (ex.: Exaltação 1): quem entrou e quem saiu. Saídas automáticas (o membro marcou "Não vou" ou teve a saída aceita) aparecem identificadas.

Em cada sala, na página do evento e no painel **⚔ Montar times**, aparece **✎ Nome · data e hora** do **último oficial ou líder** que alterou aquela sala.
Se outro oficial salvar os times enquanto você edita, o aviso antes de substituir diz quem foi e a que horas.
Os membros comuns não veem o histórico. Ele começa a contar a partir de quando o [`supabase/historico_eventos.sql`](supabase/historico_eventos.sql) for executado (veja **Dicas**).

**Registrar presença** (oficial ou líder): depois que o evento começa, ele mostra o aviso **📋 Registrar presença**.
A lista já vem marcada com quem confirmou "Vou"; basta desmarcar quem faltou e marcar quem apareceu sem avisar.

**🧑‍✈️ Contas pilotadas** (para quem joga com mais de uma conta do jogo): em **Meu perfil → Contas pilotadas**, o piloto pode:
- **Cadastrar uma conta sem login**: uma conta do jogo que só ele joga. Ela vai para "Aguardando aprovação" e um oficial ou o líder aprova.
- **Pedir acesso a uma conta existente** (que já tem dono no site): o dono aprova no perfil dele, ou um oficial ou o líder aprova em **Membros → Pedidos de piloto**.

Depois de aprovado, aparece no topo o seletor **"Respondendo como"**: o piloto escolhe a conta e responde aos eventos (Vou e Não vou, classe e atributos, Discord, pedido de saída) por ela.
- Cada conta tem a própria frequência, os próprios times e o próprio histórico.
- Uma conta pode ter vários pilotos, e o dono também continua respondendo.
- Os oficiais veem quem respondeu (ex.: "respondido por Fulano") e o selo 🧑‍✈️ nas listas e nos times.
- No painel de times aparece um alerta quando a mesma pessoa controla 2 ou mais contas confirmadas no mesmo evento.
- O dono pode remover pilotos a qualquer momento; oficiais e líder também, e ainda podem adicionar pilotos direto no perfil da conta.
- Ao remover do clã alguém que é o único piloto de contas sem login, o site oferece remover essas contas junto.

**📰 Malah News** (menu do topo): o jornal do clã, com imagens publicadas por oficiais e líder.
Todos os membros veem as edições, da mais nova para a mais antiga; clicando na imagem, ela abre no tamanho original.
Para publicar, oficiais e líder usam **+ Nova edição** e escolhem a imagem (PNG, JPG, WEBP ou GIF), o título e uma legenda opcional. Cada edição pode ser editada (título e legenda) ou apagada.
As imagens ficam num espaço **privado** do Supabase: só membros logados conseguem vê-las. Imagens muito grandes são otimizadas antes do envio.
O menu mostra um ponto vermelho quando há uma edição nova que você ainda não viu.

**Membros** (oficiais e líder):
- **Remover do clã:** o líder escolhe "Remover do clã…" no seletor de cargo; o oficial usa o botão "Remover", que só aparece para membros comuns. Informe um motivo (opcional).
  A pessoa perde o acesso e vai para a lista recolhida **Ex-membros**, no fim da página, com a data, quem removeu e o motivo.
  Presenças passadas, alterações e anotações ficam guardadas. Somente as respostas e vagas em times de eventos futuros são apagadas, e o telefone é descartado.
- **Recusar:** em "Aguardando aprovação", o botão **Recusar** move a pessoa direto para Ex-membros.
- **Voltar ao clã:** se um ex-membro entrar de novo no site, ele vê "Você não faz mais parte do clã" e pode clicar em **Pedir para voltar**. O pedido aparece em "Aguardando aprovação". O líder também pode clicar em **Readmitir** na lista de ex-membros.
- **Histórico no clã:** no perfil de cada membro aparecem todas as mudanças de cargo (entrou, aprovado, promovido, removido, voltou), com data, quem fez e o motivo.
- **Histórico:** cada mudança de nome do personagem, nome da conta Google, classe ou atributos fica registrada com a data. O botão 🕘 ao lado do membro mostra o histórico, com a diferença de cada atributo (ex.: Potência 4.692 → 5.332, +640).
- **Nome e foto da conta Google** são atualizados automaticamente a cada login.
- **Busca:** encontra um membro pelo nome atual ou por um nome antigo, que aparece como "antes: …".
- **⬇ Exportar CSV:** baixa uma planilha separada por `;`, que abre direto no Excel. Ela traz personagem, conta Google, cargo, classe, os 5 atributos, telefone, a frequência dos últimos 90 dias e a data de entrada.

**Tipos de evento:** todo evento tem um tipo (Guerra das Sombras, Vigília, Rito do Exílio ou Outros), escolhido no formulário de criação.
O site sugere o tipo pelo nome digitado; por exemplo, "Guerra das Sombras – final" vira Guerra das Sombras, e nomes que não batem com nenhum tipo viram Outros.
O nome do evento continua livre; é o **tipo** que agrupa os eventos no filtro da Frequência.

Para **cadastrar um tipo novo**, abra o Supabase → **Table Editor** → tabela `event_types` → **Insert row** e preencha:
- `name`: o nome que aparece no site (ex.: "Assalto ao Cofre");
- `sort_order`: a posição na lista (menor aparece primeiro; o "Outros" usa 999 para ficar por último);
- deixe `active` marcado.

Para **esconder** um tipo que não é mais usado, desmarque `active`. Ele some da lista de novos eventos, mas os eventos antigos continuam com ele. O banco não deixa apagar um tipo que algum evento usa.
Os membros veem o tipo novo na próxima vez que abrirem o site.

**Frequência** (menu do topo, só oficiais e líder): mostra a % de presença de cada membro no período escolhido, quantas vezes confirmou e faltou, quantas vezes não respondeu e uma linha com os últimos eventos.
Só contam eventos com presença registrada e posteriores à entrada do membro. Clique no título de uma coluna para ordenar.

**📣 Recrutamentos** (menu do topo, para todos): para montar um Grupo Guerreiro, um time PvP ou outra atividade.
1. Clique em **+ Novo recrutamento** e preencha o título, a categoria (**Evento PvP**, **Grupo Guerreiro** ou **Outro**), o número de vagas, a descrição e, se quiser, a data da atividade, o prazo de inscrição e as classes procuradas (ex.: 2 Cruzados e 1 Monge).
2. O recrutamento fica em **Aguardando aprovação** e só aparece para os outros depois que um oficial ou o líder aprovar. Oficiais não aprovam o próprio recrutamento; o do líder é publicado direto.
   Se for recusado, quem criou vê o motivo, pode corrigir e enviar de novo, ou apagar.
3. Os membros clicam em **🙋 Quero participar**. Para se candidatar, é preciso ter classe e atributos preenchidos no perfil, porque é isso que quem criou vê.
4. Quem criou **aceita** ou **recusa** cada candidato. Quem tem uma das classes procuradas aparece com ★. O contador mostra os aceitos por classe (ex.: 1/2 CRU).
5. Quando as vagas enchem, o selo **Completo** aparece. Outras pessoas ainda podem se candidatar, caso alguém saia.
6. Quem criou pode **Encerrar** (ninguém mais se candidata) e **Reabrir** depois. O prazo de inscrição é só informativo.

O filtro no topo separa por categoria. O menu mostra um contador com os recrutamentos para aprovar e os candidatos novos nos seus recrutamentos.

**🎟️ Sorteio** (menu do topo, para todos): o sorteio só acontece no domingo em que a **staff (líder ou oficiais) ativar um sorteio**. Nesse domingo, às **22h (horário de Brasília)**, o site sorteia os prêmios entre os inscritos elegíveis. Domingo sem sorteio ativado não tem sorteio.
- **Membros:** em cada sorteio aberto, clicam em **🎟️ Quero participar** (ou **Retirar inscrição**). A inscrição vale para um sorteio; na semana seguinte, é preciso se inscrever de novo.
- **Quem é elegível:** quem está inscrito e tem **presença registrada em todas as Guerras das Sombras da semana** (de segunda 00h até domingo 22h, em Brasília; normalmente 2). Conta a presença marcada pelos oficiais em **📋 Registrar presença**, não o "Vou". Por isso, registre a presença das Guerras **antes de domingo às 22h**.
- **Prêmio:** a staff escolhe de **1 a 5 Passes de Batalha Simples**, **1 Passe de Batalha Potencializado**, **1 Via do Prodígio** ou **Outros** (escrevendo o prêmio, com quantidade opcional de 1 a 10). É **um ganhador por item**: 3 passes = 3 ganhadores diferentes, cada um leva 1.
- **No horário:** o site mostra só os ganhadores, com o nome em destaque, um troféu dourado e a mensagem "Parabéns, entre em contato com a staff para retirar seu prêmio!". O resultado fica em destaque por 6 dias. Quem estiver com a página aberta às 22h vê o resultado sem precisar recarregar.
- **Últimos sorteados:** os membros veem os 3 últimos ganhadores. Enquanto não houver nenhum, aparece só o botão **Conferir últimos sorteios**.
- **Staff (líder e oficiais):** **+ Ativar sorteio** escolhe o domingo e o prêmio (dá para editar ou cancelar até o horário). O **Painel da staff** mostra as Guerras das Sombras da semana (com ou sem presença registrada) e cada inscrito com a situação: **✔ Elegível**, **⏳ Aguardando registro de presença** ou **✖ Faltou**. Também lista os sorteios já realizados, com os ganhadores e quantos estavam elegíveis.
- **Remover inscrição:** só com o **motivo por escrito**. O membro removido recebe um aviso no 🔔 para entrar em contato com a staff (ele não vê o motivo nem consegue se inscrever de novo nesse sorteio). Os **outros** oficiais e o líder recebem um alerta no 🔔 com o nome, quem removeu e o motivo.
- **Como o sorteio acontece:** a escolha é aleatória e feita no banco, uma única vez por sorteio. Com o agendamento ativo (veja **Dicas**), ela acontece exatamente às 22h; sem ele, acontece quando a primeira pessoa abre o site depois das 22h. Depois do horário, ninguém entra, sai ou é removido.
- **Permissões dos oficiais** (**⚙️ Configurações → Sorteio**, só o líder):
  - **Ativar (criar), editar e cancelar sorteios:** **Permitido** (o oficial ativa direto), **Precisa de aprovação** (o sorteio só é ativado depois que o líder aprovar em ⚙️ Configurações; o oficial acompanha em **Solicitações**) ou **Bloqueado** (só o líder ativa sorteios).
  - **Remover inscrições do sorteio:** **Permitido** ou **Bloqueado**.

**🎫 Central de Atendimento** (botão 💬 no canto da tela): o canal entre os membros e a liderança.
- **Membros:** clicam em **+ Novo ticket** e escolhem o assunto, a categoria (Sugestão, Melhorias, Reclamação / Denúncia, Dúvida, Problema no site ou Outros) e a mensagem. Dá para anexar até 3 imagens por mensagem.
- **🕶️ Anônimo:** marcando **Enviar anonimamente**, o nome fica oculto para oficiais e líder. Em casos graves, o líder pode clicar em **Revelar autor**: só ele vê o nome, e nada fica registrado no ticket.
- A conversa continua no próprio ticket. O membro pode marcar o ticket como resolvido. Se escrever num ticket resolvido, ele é reaberto.
- **🔔 Aviso de resposta:** quando a staff responde, quem abriu o ticket recebe:
  - um aviso na tela ("A staff respondeu seu ticket …"), uma única vez por resposta;
  - um contador dourado no botão **💬**;
  - o item "A staff respondeu seu ticket" no 🔔;
  - o selo **Resposta nova** no ticket.

  Com o site aberto, o aviso chega sozinho em até 1 minuto, sem recarregar. Na conversa aberta, a resposta nova aparece automaticamente. O aviso some quando a pessoa abre o ticket. Notas internas da staff não geram aviso.
- **Líder e oficiais:** veem todos os tickets, com os filtros **Em aberto**, **Não iniciado**, **Pendente comigo**, **Pendente autor**, **Abertos por mim**, **Resolvidos** e **Todos**, além do filtro por categoria.
  Podem **🙋 Assumir** um ticket (ele passa para **Em atendimento**), responder, mudar o status e escrever **🔒 notas internas**, que o membro não vê.

**⚙️ Configurações do líder** (engrenagem no topo, só o líder): para cada função dos oficiais, o líder escolhe:
- **Permitido:** o oficial faz direto (é o padrão).
- **Precisa de aprovação:** a ação do oficial vira uma solicitação e só acontece depois que o líder aprovar. Disponível para criar, editar e apagar eventos; aprovar e remover membros; publicar e apagar edições do Malah News; aprovar, encerrar, editar e apagar recrutamentos de outros membros; e ativar, editar e cancelar sorteios.
- **Bloqueado:** a opção some para os oficiais e o banco recusa a ação.

Os oficiais acompanham os pedidos deles em **Solicitações** (menu do topo), que também lista as regras definidas pelo líder. O botão **Restaurar padrão** volta tudo para "Permitido".
Nos tickets, o líder também pode impedir que os oficiais vejam, respondam ou resolvam tickets, ou deixar as **denúncias** só com ele.

**🔔 Pendências** (sino no topo): reúne o que precisa da sua atenção.
- **Para você:** eventos sem resposta, respostas novas nos seus tickets, candidatos nos seus recrutamentos, pedidos de piloto e edição nova do Malah News.
- **Liderança:** membros aguardando aprovação, tickets não iniciados ou pendentes com você e solicitações dos oficiais, conforme as permissões de cada um.

**🧰 Utils** (menu do topo, para todos): links úteis que abrem em uma nova aba. O primeiro é o **Discord da Aliança** (https://discord.gg/YncQxQ4bzB), seguido de builds, gemas, ranking PvP, Reddit, patch notes, fórum oficial, calculadora de gemas e o Discord oficial do jogo.
Para adicionar, trocar ou remover um link, edite a lista `UTIL_LINKS` no [`app.js`](app.js): cada item tem um ícone, um título, uma descrição e o endereço.

## Dicas
- **Atualizando o site:** se você já tinha executado uma versão anterior do `schema.sql`, rode o arquivo inteiro de novo no SQL Editor. Ele só acrescenta o que falta e não apaga dados. Ao publicar arquivos novos, aumente o número `?v=` no `index.html` para os navegadores baixarem a versão nova.
- **Ativar o histórico de alterações dos eventos:** no Supabase, abra o **SQL Editor**, cole todo o conteúdo de [`supabase/historico_eventos.sql`](supabase/historico_eventos.sql) e clique em **Run**. Ele só acrescenta o que falta, pode ser executado de novo e também está no fim do `schema.sql`. Enquanto ele não for executado, o site funciona normalmente, só sem o histórico.
- **Ativar o Sorteio:** no Supabase, abra o **SQL Editor**, cole todo o conteúdo de [`supabase/sorteio.sql`](supabase/sorteio.sql) e clique em **Run**. Ele só acrescenta o que falta e pode ser executado de novo sem problema. O mesmo trecho também está no fim do `schema.sql`.
  O script também agenda o sorteio às 22h com o **pg_cron** do Supabase. Se aparecer o aviso "pg_cron indisponível", ative a extensão em **Database → Extensions → pg_cron** e rode o arquivo de novo. Enquanto ela não estiver ativa, o sorteio acontece na primeira visita ao site depois das 22h.
- **Só Recrutamentos e Tickets:** o [`supabase/recrutamentos_tickets.sql`](supabase/recrutamentos_tickets.sql) instala apenas essas duas partes, sem mexer no resto. Ele depende das Configurações do líder, que já vêm no `schema.sql`. Quem roda o `schema.sql` completo não precisa dele.
- **Eventos semanais:** ao criar, escolha "Repetir por N semanas"; ou, num evento existente, use "Repetir na próxima semana".
- **Horários:** cada pessoa vê o horário no fuso do próprio celular ou PC.
- **Link direto:** "Copiar link" na página do evento gera um link para mandar no Discord.
- **Testar localmente:** rode `py -m http.server 8767` nesta pasta e abra http://localhost:8767. Para o login funcionar localmente, adicione `http://localhost:8767` às Redirect URLs do Supabase.
