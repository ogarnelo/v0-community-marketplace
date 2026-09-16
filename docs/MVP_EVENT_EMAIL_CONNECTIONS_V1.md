# MVP event email connections v1

This block connects the existing transactional email templates to marketplace events.

- First conversation message: after a successful client message insert, the client calls `POST /api/messages/send`. The server hook verifies authentication, conversation membership and that this is the sender's first message before notifying the other participant.
- Agreement proposal: the existing proposal route notifies the other participant after the agreement is persisted.
- Agreement confirmed: once both parties have confirmed, both participants receive the final confirmation email.

Email delivery is best-effort: a Resend failure is logged and never rolls back a message or agreement action.

Product scope remains unchanged. La entrega y el pago se acuerdan directamente entre las partes.
