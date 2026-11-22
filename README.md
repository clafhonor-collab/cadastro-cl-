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
  Eventos de torre (tipo ou nome com "torre", como Guerra das Torres e Torre Amaldiçoada) têm de **1 a 4 times de até 10 membros** (Time 1, Time 2…). Quem cria o evento escolhe a quantidade no formulário; dá para mudar depois na montagem dos times. Não dá para escolher o formato Guerra nem renomear.
  No "Sugerir times", a opção **Mais fortes com tanques** escolhe os mais fortes pela Ressonância para preencher os times, garante pelo menos 3 tanques (Druida, Cruzado ou Bárbaro) em cada time e equilibra as classes e a força entre os times. Cada time mostra 🛡 com o número de tanques (em vermelho se tiver menos de 3).
  Uma torre criada antes com outro formato passa sozinha para os times de torre se ninguém estiver escalado; se já houver membros escalados, o site pede para converter. Para times de 10, rode o [`supabase/torres_times.sql`](supabase/torres_times.sql).
- **Preferência por partidas de 4 pontos** (Guerra das Sombras e Vigília): ao confirmar presença, o membro pode marcar a opção.
  Ele fica com a bandeira vermelha 🚩 (e borda vermelha) nos times e na lista de confirmados. O "Sugerir times" nunca coloca essas pessoas em Exaltação, só de Eminência em diante.
  Oficiais e líder ainda podem colocar a pessoa em Exaltação manualmente: o site avisa e pede confirmação. Ative com o [`supabase/partidas_4_pontos.sql`](supabase/partidas_4_pontos.sql).
- **Frequência**: depois do evento, um oficial marca quem realmente compareceu. O painel mostra a % de presença de cada membro, quem confirmou e faltou e quem não respondeu.
- Em cada evento aparece quem vai, quem não vai e quem ainda não respondeu. O botão "Copiar lista" gera um texto pronto para colar no Discord. O "Copiar times" gera a lista para o grupo do WhatsApp: o nome de cada time em negrito e um nome por linha, com um ponto (•) na frente.
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
| Editar o nick de membros comuns (e de quem aguarda aprovação) | | ✔ | ✔ |
| Editar o nick de oficiais | | | ✔ |
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
O site não manda notificação; use **📋 Copiar times** para avisar no grupo do WhatsApp.

**Meu perfil** (menu do topo, para todos: membros, oficiais e líder): é o painel individual de cada um.
Oficiais e líder também abrem o **perfil de qualquer membro**: basta clicar no membro na lista de **Membros** ou no nome dele na tabela de **Frequência**.
Nesse caso, o painel também mostra o telefone (se informado) e o botão "← Membros" para voltar, mas não tem "Editar perfil", porque cada um edita só o próprio (a staff pode trocar só o nick, em **✎ Editar nick**).
No próprio painel, o botão **📷 Trocar foto** troca a foto de perfil na hora, sem abrir o formulário. Ela também pode ser trocada em **✎ Editar perfil**.
Trocar ou remover a foto nesse formulário não apaga o que já foi digitado (nome, telefone, classe e atributos), inclusive no cadastro de quem acabou de entrar.
**💪 Rank de força (Top 10 do clã):** mostra só o nick, a classe e a pontuação, **sem fotos**. No lugar da foto, cada jogador aparece como uma armadura: **dourada** para o 1º lugar, **prateada** para o 2º e **bronze** para o 3º (um pouco maiores), e uma armadura padrão do 4º ao 10º.
**🧑‍✈️ Membro piloto:** no cadastro (e depois, em **✎ Editar perfil**), a pessoa escolhe entre **🎮 Jogador** (tem a própria conta no jogo) e **🧑‍✈️ Membro piloto** (não tem conta própria, só pilota contas de outros membros).
- O membro piloto não preenche classe e atributos: informa só o **nome** e **qual conta pilota**. A aprovação é igual à dos outros membros (aparece em "Aguardando aprovação", com a conta que ele informou).
- Ele não responde eventos pela própria conta, só pelas contas que pilota (em **"Respondendo como"**), e fica **fora do rank de força, da média do clã e da frequência**: contam só as contas que ele pilota.
- Depois de aprovado, ele pede acesso à conta em **Meu perfil → Pilotos** (o dono da conta ou a staff aprova). A staff também pode usar **+ Vincular conta** no perfil dele.
- No **Meu perfil** dele aparecem o Top 10 do clã e as demais opções, mas não a frequência, as comparações com a média do clã e a evolução do personagem.
- A staff vê os membros piloto numa aba própria em **Membros → 🧑‍✈️ Membros piloto**, com as contas que cada um pilota e a lista de membros jogadores que também pilotam.
- A staff também pode **transformar um membro em membro piloto** (botão **🧑‍✈️ Tornar piloto** na lista de Membros ou no perfil dele) e desfazer com **🎮 Tornar jogador**. O líder pode fazer isso com qualquer conta; oficiais, com membros e com quem aguarda aprovação, se tiverem a permissão "Gerenciar pilotos de contas". Ao virar membro piloto, as respostas da própria conta nos próximos eventos são retiradas e quem pilotava a conta dele deixa de pilotar; classe e atributos ficam guardados. A mudança entra no histórico do membro, com quem fez. Contas sem login não podem virar membro piloto.

**Também sou piloto:** um membro jogador pode marcar **"Também sou piloto"** em ✎ Editar perfil. Ele continua jogando com a própria conta e pode pilotar outras (o site já mostra que ele usa mais de uma conta), e passa a poder se cadastrar na **Pilotagem**.

**✈️ Pilotagem (Utils):** os pilotos (membros piloto e quem marcou "Também sou piloto") cadastram um anúncio com seus horários e como podem ajudar, e podem pausá-lo ou sair quando quiserem.
**🛡 Aprovação dos anúncios:** o anúncio só aparece em "Pilotos disponíveis" depois que a staff aprova. Os anúncios aguardando aparecem no topo da Pilotagem e no sininho para o líder e os oficiais com a permissão "Gerenciar pilotos de contas". A staff aprova, ou recusa com um motivo opcional, que o piloto vê. Se o piloto mudar o texto, o anúncio volta para a aprovação; pausar ou voltar a ficar disponível não precisa. Oficial não aprova o próprio anúncio (o líder pode).
**✏️ Edição do anúncio:** o autor edita o texto em **Seu anúncio → Editar**. Se o anúncio já estava aprovado, a edição vai para a revisão da staff (aparece na fila como "✏️ Edição", com o texto publicado e o novo lado a lado) e, até a aprovação, os membros continuam vendo o texto aprovado. Se a staff recusar, o texto aprovado continua e o autor vê o motivo.
**📣 Divulgar o anúncio:** depois de aprovado, o piloto tem em **Seu anúncio** os botões **▣ Gerar QR Code** e **🔗 Copiar link**. O QR Code vem numa imagem pronta (1080×1350) com o nome do piloto, o texto do anúncio e o QR, para **baixar** ou **compartilhar** (no celular). O link (`forhonorcla.com.br/#/pilotagem/…`) e o QR abrem a Pilotagem já rolada até o anúncio, em destaque. Quem ainda não entrou no site faz o login e cai no anúncio. Se o anúncio for pausado ou removido, o link avisa que ele não está disponível. O gerador de QR Code ([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), licença MIT) fica em `vendor/` e só é carregado quando usado.
**📜 Registro dos anúncios:** a liderança vê, no fim da página Pilotagem, cada envio, edição, aprovação, recusa e remoção, com quem fez, quando, o texto e o motivo. Em cada anúncio publicado aparece também "Aprovado por …" (só a liderança vê). O registro não é apagado quando o anúncio muda ou sai da Pilotagem.
Qualquer membro pode clicar em **Solicitar pilotagem** num anúncio (até 3 pedidos em aberto por pessoa). O piloto recebe o aviso no **sininho** e aceita ou recusa. Ao aceitar, ele passa a pilotar a conta de quem pediu, como num pedido de piloto aprovado. O dono tira o piloto quando quiser em Meu perfil → Pilotos.
A staff vê todos os pedidos e pode remover anúncios.

**Quem criou o evento:** a staff vê na página do evento e no **🕘 Histórico de alterações** quem criou o evento e quando. Se foi criado por solicitação de um oficial aprovada pelo líder, aparece também quem pediu.

Membros comuns não conseguem abrir o perfil de outra pessoa. O painel mostra:
- os dados do membro, com um botão para editar o perfil;
- a frequência no período escolhido, as presenças, a sequência atual de presenças e quantas vezes confirmou e faltou;
- os próximos eventos, com a resposta dada e o time, destacando os que ainda estão sem resposta;
- os 5 atributos comparados com a média do clã;
- **📈 Evolução do personagem**: gráfico de cada atributo ao longo do tempo. O **recorde** (maior valor já registrado) aparece como um **ponto azul** no gráfico, com a legenda embaixo; quando o valor atual está abaixo do recorde, o quadro também mostra **🏔️ Maior já registrado** em destaque no canto superior direito;
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
Na mesma janela (também em **Editar presença**, nos eventos passados), **Selecionar todos** marca todos os membros de uma vez (com a busca preenchida, só os encontrados), **Marcar quem confirmou** volta para quem disse "Vou" e **Desmarcar todos** limpa a lista.

**🧑‍✈️ Contas pilotadas** (para quem joga com mais de uma conta do jogo): em **Meu perfil → Contas pilotadas**, o piloto pode:
- **Cadastrar uma conta sem login**: uma conta do jogo que só ele joga. Ela vai para "Aguardando aprovação" e um oficial ou o líder aprova.
- **Pedir acesso a uma conta existente** (que já tem dono no site): o membro digita pelo menos 3 letras do nick da conta e escolhe entre os resultados. O dono aprova no perfil dele, ou um oficial ou o líder aprova em **Membros → Pedidos de piloto**.

Depois de aprovado, aparece no topo o seletor **"Respondendo como"**: o piloto escolhe a conta e responde aos eventos (Vou e Não vou, classe e atributos, Discord, pedido de saída) por ela.
- Cada conta tem a própria frequência, os próprios times e o próprio histórico.
- Uma conta pode ter vários pilotos, e o dono também continua respondendo.
- O piloto **não pode trocar o nick nem a foto** da conta do dono. Isso vale também direto pela API. Nas contas sem login, que o próprio piloto cadastrou, ele continua podendo.
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
- **Líder altera atributos:** no perfil de qualquer conta (membro, oficial ou conta sem login), só o líder vê o botão **✎ Editar perfil**, que altera a classe e os atributos. A troca entra no histórico do perfil com quem alterou.
  O dono da conta (e quem pilota a conta) recebe o aviso "Seus atributos foram alterados pela liderança, entrar em contato com a staff.", com o que mudou. O aviso aparece ao entrar no site e no 🔔 até a pessoa clicar em **Entendi**.
  Ative com o [`supabase/lider_atributos.sql`](supabase/lider_atributos.sql).
- **Histórico de aprovações:** lista recolhida no fim da página Membros, só para oficiais e líder. Mostra quem aprovou cada membro novo (e cada readmissão), com cargo, data e hora, do mais recente para o mais antigo.
  Dá para filtrar por quem aprovou, e a busca de nomes também filtra a lista. Usa o histórico de cargos que o banco já guarda (tabela `membership_log`); não precisa rodar SQL.
- **Histórico no clã:** no perfil de cada membro aparecem todas as mudanças de cargo (entrou, aprovado, promovido, removido, voltou), com data, quem fez e o motivo.
- **Histórico:** cada mudança de nome do personagem, nome da conta Google, classe ou atributos fica registrada com a data. O botão 🕘 ao lado do membro mostra o histórico, com a diferença de cada atributo (ex.: Potência 4.692 → 5.332, +640).
- **✎ Nick:** o botão ao lado do membro (ou **✎ Editar nick** no perfil dele) troca o nome do personagem que aparece no site.
  O oficial edita o nick de membros, de quem aguarda aprovação e de ex-membros; o líder edita o de qualquer pessoa. Cada um troca o próprio nick em **Editar perfil**.
  A troca vai para o **🕘 Histórico** do membro com "por Nome", mostrando quem trocou. Nas **Configurações**, o líder escolhe se os oficiais podem fazer isso direto, com aprovação ou nunca.
  Para funcionar, rode o [`supabase/editar_nick.sql`](supabase/editar_nick.sql) (veja **Dicas**).
- **Nick único:** duas contas ativas (aguardando aprovação, membro, oficial ou líder) não podem ter o mesmo nick. Isso impede alguém de se passar por outro membro, como o líder.
  A comparação ignora maiúsculas, acentos e espaços extras ("Máximus" = "maximus"). Vale ao editar o perfil, quando a staff troca o nick, ao cadastrar conta pilotada e ao aprovar ou readmitir alguém.
  Ex-membros não contam: o nick de quem saiu pode ser usado de novo. Ative com o [`supabase/nick_unico.sql`](supabase/nick_unico.sql) (veja **Dicas**).
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

   **Limite:** cada pessoa pode ter até **3 recrutamentos ativos** (aguardando aprovação ou abertos). A página mostra o aviso e quantos você já tem. Ao chegar a 3, o botão fica desativado até você encerrar um. Reabrir um recrutamento encerrado também conta.
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
- **Limites:** cada pessoa pode abrir até **3 tickets por dia** (no horário de Brasília) e enviar até **30 mensagens por hora**. A staff não tem limite de mensagens, para não travar o atendimento.
  O aviso fica visível no topo da Central de Atendimento, com quantos tickets você já abriu hoje. Ao chegar a 3, o botão de novo ticket fica desativado até o dia seguinte.
- **🕶️ Anônimo:** marcando **Enviar anonimamente**, o nome fica oculto para oficiais e líder. Em casos graves, o líder pode clicar em **Revelar autor**: só ele vê o nome, e nada fica registrado no ticket.
- A conversa continua no próprio ticket. O membro pode marcar o ticket como resolvido. Se escrever num ticket resolvido, ele é reaberto.
- **🔔 Aviso de resposta ou encerramento:** quando a staff responde ou resolve (encerra) um ticket, quem abriu recebe:
  - ao entrar no site, um aviso **📬 Novidades nos seus tickets** no canto da tela, com cada ticket ("A staff respondeu", "A staff resolveu e encerrou") e o botão **Abrir →** que leva direto a ele. O aviso continua até a pessoa abrir o ticket ou fechar o aviso no **✕**;
  - um contador dourado no botão **💬**;
  - o item "A staff respondeu seu ticket" no 🔔;
  - o selo **Resposta nova** no ticket.

  Com o site aberto, o aviso chega sozinho em até 1 minuto, sem recarregar. Na conversa aberta, a resposta nova aparece automaticamente. O aviso some quando a pessoa abre o ticket. Notas internas da staff não geram aviso.
- **Líder e oficiais:** veem todos os tickets, com os filtros **Em aberto**, **Não iniciado**, **Pendente comigo**, **Pendente autor**, **Abertos por mim**, **Resolvidos** e **Todos**, além do filtro por categoria.
  Podem **🙋 Assumir** um ticket (ele passa para **Em atendimento**), responder, mudar o status e escrever **🔒 notas internas**, que o membro não vê.
- **✔ Quem encerrou:** todo ticket resolvido mostra se foi encerrado **pelo jogador** (quem abriu) ou **pela staff** (com o nome de quem encerrou), com a data e a hora. Isso aparece na lista de resolvidos e no topo do ticket.
  Dentro da conversa, as mudanças de status aparecem na ordem em que aconteceram: colocado em atendimento, encerrado e reaberto, cada uma com quem fez.
  Em ticket anônimo, aparece só "pelo jogador (anônimo)", sem o nome. O histórico começa a contar a partir de quando o [`supabase/tickets_historico.sql`](supabase/tickets_historico.sql) for executado (veja **Dicas**).

**⚙️ Configurações do líder** (engrenagem no topo, só o líder): para cada função dos oficiais, o líder escolhe:
- **Permitido:** o oficial faz direto (é o padrão).
- **Precisa de aprovação:** a ação do oficial vira uma solicitação e só acontece depois que o líder aprovar. Disponível para criar, editar e apagar eventos; aprovar e remover membros; editar o nick dos membros; publicar e apagar edições do Malah News; aprovar, encerrar, editar e apagar recrutamentos de outros membros; e ativar, editar e cancelar sorteios.
- **Bloqueado:** a opção some para os oficiais e o banco recusa a ação.

Os oficiais acompanham os pedidos deles em **Solicitações** (menu do topo), que também lista as regras definidas pelo líder. O botão **Restaurar padrão** volta tudo para "Permitido".
Nos tickets, o líder também pode impedir que os oficiais vejam, respondam ou resolvam tickets, ou deixar as **denúncias** só com ele.

**☰ Menu no celular:** em telas de até 760px (celular e tablet em pé), os itens do menu ficam escondidos atrás do botão ☰, ao lado do logo. Ao tocar, abre um painel lateral com os itens (com ícones) e a página atual destacada. Ele fecha ao escolher um item, no ✕, tocando fora do painel ou com Esc. No computador, o menu continua no topo, como antes.

**🔔 Pendências** (sino no topo): reúne o que precisa da sua atenção.
- **Para você:** eventos sem resposta, respostas novas nos seus tickets, candidatos nos seus recrutamentos, pedidos de piloto e edição nova do Malah News.
- **Liderança:** membros aguardando aprovação, tickets não iniciados ou pendentes com você e solicitações dos oficiais, conforme as permissões de cada um.
- **🕘 Últimas notificações:** no fim da lista ficam as 4 últimas notificações que já saíram das pendências (vistas ou resolvidas), com a data em que chegaram. Quando chega uma nova, a mais antiga sai. Fica guardado no navegador de cada aparelho.

**🧰 Utils** (menu do topo, para todos): links úteis que abrem em uma nova aba. O primeiro é o **Discord da Aliança** (https://discord.gg/YncQxQ4bzB), seguido de builds, gemas, ranking PvP, Reddit, patch notes, fórum oficial, calculadora de gemas e o Discord oficial do jogo.
Para adicionar, trocar ou remover um link, edite a lista `UTIL_LINKS` no [`app.js`](app.js): cada item tem um ícone, um título, uma descrição e o endereço.

## Segurança dos dados

O site roda no navegador e conversa direto com o Supabase. Por isso, **qualquer pessoa logada consegue fazer as mesmas consultas fora do site** (Postman, console do navegador), usando o próprio login. Isso é normal e não dá para impedir.
A chave do `config.js` é pública de propósito. A chave secreta do Supabase (`service_role`) **nunca** deve ir para o site.

O que protege os dados são as **regras do banco (RLS)** e as funções, que valem para qualquer consulta, de dentro ou de fora do site:
- **Membro comum lê só o que o site mostra para ele:**
  - os eventos;
  - as próprias respostas e as das contas que pilota;
  - o próprio time;
  - os perfis completos só das próprias contas (e das que pilota). **O site não busca a lista de perfis para o membro comum**: só oficiais e o líder recebem essa lista (`list_profiles`);
  - dos outros, **só o nome** de quem aparece para ele no site (função `my_people`): colegas de time, recrutamentos que ele vê, ganhadores do sorteio, quem atendeu os tickets dele, pilotos e autores do Malah News. Não vêm foto, endereço de imagem, cargo, datas nem o nome da conta Google de quem tem nick. A classe vem só onde o site a mostra, e os atributos só dos candidatos de recrutamento;
  - no pedido de piloto, a conta é encontrada **digitando o nick** (mínimo de 3 letras, até 8 resultados, função `find_accounts`), sem baixar a lista do clã;
  - a média de atributos do clã, só como média (função `clan_averages`);
  - recrutamentos, sorteios e Malah News;
  - os próprios tickets.
- **Ficam só com a staff:**
  - telefones;
  - anotações internas;
  - histórico de alterações;
  - histórico de eventos;
  - pedidos de saída;
  - tickets de outras pessoas;
  - solicitações e configurações dos oficiais.
- **Nada é gravado sem passar pelas regras:** o banco confere o cargo e as permissões em cada ação (cargo, times, presença, eventos, sorteio, tickets etc.).
- **Respostas dos eventos:** mesmo pela API, o prazo e os times travados valem também para o evento de destino. Não dá para mudar o evento ou a conta de uma resposta, forjar "respondido por" nem criar um pedido de saída sem o botão do site.
- **Fotos:** a foto de perfil só aceita endereços do espaço de fotos do próprio Supabase. As imagens de tickets e da Malah News são redesenhadas antes do envio, o que apaga os metadados (localização GPS, modelo do celular, data). Isso protege também quem abre ticket anônimo.
- **No navegador:**
  - o script do Supabase é carregado com verificação de integridade (`integrity`): se o arquivo for alterado no CDN, o navegador recusa;
  - uma política de segurança (`Content-Security-Policy`, no `index.html`) só permite scripts, imagens e conexões do próprio site, do Supabase, do Google e das fontes.

  Ao trocar o projeto do Supabase ou a versão do `supabase-js`, atualize o endereço na política e o hash `integrity` no `index.html`.
- **Limites contra spam** (valem também pela API):
  - 3 tickets por dia por pessoa;
  - 30 mensagens por hora por pessoa (a staff não tem esse limite);
  - 3 recrutamentos ativos por pessoa.
- **Pilotos:** não trocam o nick nem a foto da conta do dono.
- **Nick único:** ninguém ativo no clã pode usar o mesmo nick de outra pessoa (veja **Membros**).

Para aplicar os ajustes mais recentes, rode o [`supabase/seguranca_dados.sql`](supabase/seguranca_dados.sql), o [`supabase/seguranca_correcoes.sql`](supabase/seguranca_correcoes.sql) e o [`supabase/limites.sql`](supabase/limites.sql) (veja **Dicas**).
## Login com código por e-mail
Para quem não consegue entrar com o Google (navegador do WhatsApp/Instagram, conta Google bloqueada etc.), a tela de login tem **"Problemas com o Google? Entrar com código por e-mail"**:
- A pessoa digita o e-mail. Se já existe conta com esse e-mail, o site mostra o nome só em parte (ex.: "Va*****a") e envia um código. Com o mesmo e-mail da conta Google, ela entra **na mesma conta**.
- Se o e-mail não tem conta, ela preenche nome do personagem, telefone (opcional), classe e atributos, e a conta nova fica em **Aguardando aprovação**.
- O site também avisa quando foi aberto dentro de outro aplicativo (onde o Google bloqueia o login) e quando o login do Google não terminou.

Para ativar (uma vez):
1. Rode o [`supabase/login_email.sql`](supabase/login_email.sql) no SQL Editor (só cria a função `login_lookup`; também está no fim do `schema.sql`).
2. No Supabase, **Authentication → Sign In / Providers → Email**: ative e salve.
3. **Authentication → Emails → SMTP Settings**: configure um envio próprio (ex.: [Resend](https://resend.com), com o domínio `forhonorcla.com.br` verificado). Sem isso, o Supabase só envia e-mails para quem faz parte da equipe do projeto, e poucos por hora.
4. **Authentication → Emails → Templates**: em **Magic Link** e em **Confirm signup**, troque o texto para mostrar o código, por exemplo: `Seu código para entrar no FOR HONOR: <h2>{{ .Token }}</h2>`.
5. Em **Authentication → Rate Limits**, aumente o limite de e-mails por hora se precisar.

Na demonstração (`?demo`), use `lider@exemplo.com` para entrar na conta do líder, qualquer outro e-mail para criar uma conta nova, e o código `123456`.

## Dicas
- **Atualizando o site:** se você já tinha executado uma versão anterior do `schema.sql`, rode o arquivo inteiro de novo no SQL Editor. Ele só acrescenta o que falta e não apaga dados. Ao publicar arquivos novos, aumente o número `?v=` no `index.html` para os navegadores baixarem a versão nova.
- **Ativar o histórico de alterações dos eventos:** no Supabase, abra o **SQL Editor**, cole todo o conteúdo de [`supabase/historico_eventos.sql`](supabase/historico_eventos.sql) e clique em **Run**. Ele só acrescenta o que falta, pode ser executado de novo e também está no fim do `schema.sql`. Enquanto ele não for executado, o site funciona normalmente, só sem o histórico.
- **Login sem o endereço do Supabase:** no login padrão, a janela do Google mostra `…supabase.co`. Para ela mostrar **forhonorcla.com.br** (sem custo):
  1. No [Google Cloud](https://console.cloud.google.com/apis/credentials), abra **APIs e serviços → Credenciais** e clique no cliente OAuth usado no Supabase (tipo "Aplicativo da Web").
  2. Em **Origens JavaScript autorizadas**, adicione `https://forhonorcla.com.br` e salve. Não remova nada em "URIs de redirecionamento autorizados".
  3. No `config.js`, preencha `googleClientId` com o **ID do cliente** desse mesmo cliente (termina em `.apps.googleusercontent.com`).

  A tela de entrada passa a usar o botão oficial do Google, e a janela diz "Fazer login em forhonorcla.com.br". Se o script do Google não carregar, o site volta sozinho para o botão antigo. Para voltar ao login antigo, deixe `googleClientId` vazio.
  Na **Tela de consentimento OAuth** (Google Auth Platform → Branding), vale preencher o nome do app (**FOR HONOR**), o logotipo e `forhonorcla.com.br` em **Domínios autorizados**.
- **Ativar o histórico de quem encerrou os tickets:** do mesmo jeito, cole todo o conteúdo de [`supabase/tickets_historico.sql`](supabase/tickets_historico.sql) no **SQL Editor** e clique em **Run**. Ele também só acrescenta o que falta, pode ser executado de novo e está no fim do `schema.sql`.
- **Ativar a edição de nick pela staff:** do mesmo jeito, rode o [`supabase/editar_nick.sql`](supabase/editar_nick.sql) no **SQL Editor**. Ele só cria a função `set_member_name`, pode ser executado de novo e está no fim do `schema.sql`.
- **Ajuste de segurança (perfis e respostas):** rode o [`supabase/seguranca_dados.sql`](supabase/seguranca_dados.sql) no **SQL Editor**. Ele só troca duas regras de leitura e cria a função `list_profiles`; nenhum dado é alterado. Pode ser executado de novo e está no fim do `schema.sql` (veja **Segurança dos dados**).
- **Correções de segurança (respostas e fotos):** rode o [`supabase/seguranca_correcoes.sql`](supabase/seguranca_correcoes.sql) no **SQL Editor**. Ele trava as respostas dos eventos contra alterações indevidas pela API e só aceita fotos de perfil do espaço de fotos do site. Fotos com endereço de fora são removidas, e a pessoa volta para a foto do Google ou a inicial. Pode ser executado de novo e está no fim do `schema.sql`.
- **Limites e regra dos pilotos:** rode o [`supabase/limites.sql`](supabase/limites.sql) no **SQL Editor**. Ele ativa os limites de 3 tickets por dia, 30 mensagens por hora e 3 recrutamentos ativos por pessoa, e impede o piloto de trocar o nick e a foto da conta do dono. Só cria gatilhos, nenhum dado é alterado. Pode ser executado de novo e está no fim do `schema.sql`. Para mudar os números, altere o `limites.sql` e a constante `LIMITS` no `app.js`.
- **Nick único:** rode o [`supabase/nick_unico.sql`](supabase/nick_unico.sql) no **SQL Editor**. Primeiro ele verifica se já existem nicks repetidos.
  - Se existirem, ele para sem alterar nada e mostra a lista (nick, cargo e data de entrada de cada conta). Troque os repetidos em **Membros → ✎ Nick** e rode de novo.
  - Se não existirem, a regra é ativada.

  Pode ser executado de novo e está no fim do `schema.sql`.
- **Membro piloto e Pilotagem:** rode o [`supabase/pilotagem.sql`](supabase/pilotagem.sql) no **SQL Editor**. Ele acrescenta o tipo de conta (membro piloto e "também sou piloto"), a Pilotagem e os pedidos de pilotagem, e tira os membros piloto do rank de força e da média do clã. Nenhum dado é alterado. Pode ser executado de novo e está no fim do `schema.sql`. Enquanto ele não for executado, a Pilotagem mostra um aviso e salvar o tipo de conta dá erro.
- **Staff transforma membro em membro piloto:** rode o [`supabase/membro_piloto_staff.sql`](supabase/membro_piloto_staff.sql) no **SQL Editor** (depois do `pilotagem.sql`). Ele cria a função `set_member_kind` e passa a registrar no histórico quando alguém vira membro piloto. Nenhum dado é alterado. Pode ser executado de novo e está no fim do `schema.sql`.
- **Aprovação dos anúncios de pilotagem:** rode o [`supabase/pilotagem_aprovacao.sql`](supabase/pilotagem_aprovacao.sql) no **SQL Editor** (depois do `pilotagem.sql`). Os anúncios que já existiam continuam publicados; os novos passam a esperar a aprovação da staff. Pode ser executado de novo e está no fim do `schema.sql`.
- **Edição dos anúncios e registro da Pilotagem:** rode o [`supabase/pilotagem_edicao_registro.sql`](supabase/pilotagem_edicao_registro.sql) no **SQL Editor**, depois do `pilotagem_aprovacao.sql`. Os anúncios que já existem entram no registro com a situação atual. Pode ser executado de novo e está no fim do `schema.sql`.
- **Ativar o Sorteio:** no Supabase, abra o **SQL Editor**, cole todo o conteúdo de [`supabase/sorteio.sql`](supabase/sorteio.sql) e clique em **Run**. Ele só acrescenta o que falta e pode ser executado de novo sem problema. O mesmo trecho também está no fim do `schema.sql`.
  O script também agenda o sorteio às 22h com o **pg_cron** do Supabase. Se aparecer o aviso "pg_cron indisponível", ative a extensão em **Database → Extensions → pg_cron** e rode o arquivo de novo. Enquanto ela não estiver ativa, o sorteio acontece na primeira visita ao site depois das 22h.
- **Só Recrutamentos e Tickets:** o [`supabase/recrutamentos_tickets.sql`](supabase/recrutamentos_tickets.sql) instala apenas essas duas partes, sem mexer no resto. Ele depende das Configurações do líder, que já vêm no `schema.sql`. Quem roda o `schema.sql` completo não precisa dele.
- **Dias e horários fixos:** ao criar ou editar um evento destes tipos, o site já coloca a data no próximo dia permitido e não deixa salvar fora dele (horário de Brasília):
  - **Guerra das Sombras:** só quintas e sábados, às 19:30;
  - **Vigília:** só domingos, às 20:00;
  - **Torre Amaldiçoada (Torres):** só quintas e sábados, às 20:00.

  Os outros tipos continuam livres. Para mudar as regras, altere `TYPE_SCHEDULE` no `app.js`.
- **Eventos semanais:** ao criar, escolha "Repetir por N semanas"; ou, num evento existente, use "Repetir na próxima semana".
- **Horários:** cada pessoa vê o horário no fuso do próprio celular ou PC.
- **Link direto:** "Copiar link" na página do evento gera um link para mandar no Discord.
- **Testar localmente:** rode `py -m http.server 8767` nesta pasta e abra http://localhost:8767. Para o login funcionar localmente, adicione `http://localhost:8767` às Redirect URLs do Supabase.
