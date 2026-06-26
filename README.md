# ServiceNow-Problem-Task-Notification-Job


## Sobre o Projeto
Este projeto contém um *Scheduled Job* para a plataforma ServiceNow. O objetivo principal do script é monitorar os prazos (`due_date`) de tarefas de problema (`problem_task`) e disparar notificações automáticas (via E-mail e integração com Microsoft Teams) para os responsáveis.

O script é ideal para manter a governança e garantir que as equipes sejam alertadas de forma proativa sobre o ciclo de vida das tarefas.

##  Regras de Negócio
O script roda periodicamente e avalia as tarefas ativas, aplicando as seguintes regras de notificação:

* **Expirando (Expiring):** Notifica o responsável **15 dias antes** do prazo e **1 dia útil antes** do vencimento. O cálculo de dias úteis respeita um calendário (*Schedule*) configurado na plataforma.
* **Expiradas (Expired):** Notifica o responsável no dia em que a tarefa vence e continua enviando alertas recorrentes a cada **15 dias** de atraso.
* **Multilíngue:** O script identifica o idioma de preferência do usuário (`preferred_language`) para garantir que os dados enviados no payload do Teams sejam traduzidos de acordo.

##  Pré-requisitos
Para que este job funcione corretamente na sua instância ServiceNow, você precisará ter os seguintes elementos configurados:

1. **Eventos (Event Registry):**
   * `custom.problem.taskexpired.notification`
   * `custom.problem.taskexpiring.notification`
   * `custom.problem.notificationTEAMS`
2. **Schedule:** Um calendário válido na tabela `cmn_schedule` para que o sistema consiga calcular corretamente o que é um "dia útil".
3. **Notificações:** As *Email Notifications* (Sysemails) devem estar configuradas para disparar quando os eventos acima forem acionados.

##  Customização (Como usar)
Antes de ativar o job na sua instância, você precisa alterar algumas variáveis no código para refletir o seu ambiente:

* **SCHEDULE_ID:** Substitua `00000000000000000000000000000000` pelo Sys_ID do calendário de dias úteis da sua empresa.
* **Hashes de Integração (`json.hashProduct`):** Substitua os textos `DUMMY-HASH-EXPIRED-FLOW-0001` e `DUMMY-HASH-EXPIRING-FLOW-0002` pelas chaves reais da sua integração com o webhook do Teams.
* **Campos Customizados:** O código faz referência a um campo de exemplo chamado `u_custom_reason`. Substitua-o pelo nome correto do campo na sua instância ou remova a linha caso não utilize.

##  Contribuição
Sinta-se à vontade para fazer um *fork* deste repositório, abrir *issues* ou enviar *pull requests* com melhorias e otimizações de código!
