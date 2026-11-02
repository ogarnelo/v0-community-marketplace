    } else if (message.type === "text" && typeof message.text?.body === "string") {
      const command = message.text.body.trim().toLocaleUpperCase("es-ES");
      if (command === "CANCELAR") {
        oldPhotoToDiscard = state.draftPhotoPath;
        state = { step: "idle", payload: {}, draftPhotoPath: null };
        reply = "Borrador descartado. Envíame otra foto cuando quieras.";
      } else if ((state.step === "review_photo" || state.step === "form") &&
                 state.payload.listingId) {
        // Never send arbitrary text to the model or use text commands to publish.
        const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
        reply = `Tienes un borrador privado pendiente. Revísalo en Wetudy: ${origin}/account/whatsapp/draft?draft=${state.payload.listingId}\nPara descartarlo, responde CANCELAR.`;
      } else {
        reply = "Este número solo permite iniciar un anuncio enviando una foto. No es un chat general de IA.";
      }
    } else {
      reply = "Para preparar un anuncio envía una fotografía. Comprueba que no contenga datos personales.";
    }

    const { data: completed, error: completionError } = await admin.rpc("complete_whatsapp_incoming", {
      p_user_id: userId,
      p_message_id: messageId,
      p_lease_id: leaseId,
      p_step: state.step,
      p_payload: state.payload,
      p_photo_path: state.draftPhotoPath,
    });
    if (completionError || completed !== true) throw new Error("Could not save WhatsApp draft transition");

    if (oldPhotoToDiscard && oldPhotoToDiscard !== state.draftPhotoPath) {
      await discardPhoto(oldPhotoToDiscard);
    }
    // Do not revert a completed state if the outbound message fails.
    try {
      await sendWhatsappPilotMessage(sender, reply);
    } catch {
      console.error("WhatsApp pilot: outbound answer failed after state commit");
    }
    return "handled";
  } finally {
    await admin.rpc("release_whatsapp_incoming", {
      p_user_id: userId, p_lease_id: leaseId,
    }).catch(() => undefined);
  }
}
