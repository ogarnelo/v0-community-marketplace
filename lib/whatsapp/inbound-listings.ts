    } else if (message.type === "text" && typeof message.text?.body === "string") {
      const next: WhatsappNext = state.step === "form" && message.text.body.trim().toLocaleUpperCase("es-ES") !== "CANCELAR"
        ? {
            state,
            response: `Tu propuesta está lista. Ábrela aquí para revisar el formulario y publicarla: https://${process.env.VERCEL_URL}/account/whatsapp/draft?draft=${state.payload.listingId}\nSi quieres descartarla, responde CANCELAR.`,
          }
        : advanceWhatsappListing(state, message.text.body);
      if (next.publish) {
        // The only publish path: an explicit, verified 'PUBLICAR' reply in review state.
        const publishedId = await publishWhatsappConfirmedListing(
          userId, state.payload, state.draftPhotoPath
        );
        oldPhotoToDiscard = state.draftPhotoPath;
        state = { step: "published", payload: { listingId: publishedId }, draftPhotoPath: null };
        const previewOrigin = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "https://www.wetudy.com";
        reply = `✅ Anuncio publicado tras tu confirmación. Puedes verlo en ${previewOrigin}/marketplace/listing/${publishedId}\n\nEnvíame otra foto para publicar más material.`;
      } else if (message.type === "text" && typeof message.text?.body === "string") {
      const command = message.text.body.trim().toLocaleUpperCase("es-ES");
      if (command === "CANCELAR") {
        oldPhotoToDiscard = state.draftPhotoPath;
        state = { step: "idle", payload: {}, draftPhotoPath: null };
        reply = "Borrador descartado. Envíame otra foto cuando quieras.";
      } else if ((state.step === "review_photo" || state.step === "form") &&
                 state.payload.listingId) {
        // No free-text instructions are ever sent to OpenAI or used to publish.
        const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
        reply = `Tienes un borrador privado pendiente. Revísalo en Wetudy: ${origin}/account/whatsapp/draft?draft=${state.payload.listingId}\nPara descartarlo, responde CANCELAR.`;
      } else {
        reply = "Este número solo permite iniciar un anuncio enviando una foto. No es un chat general de IA.";
      }
    } else {
        state = next.state;
        reply = next.response;
        if (next.cleanup) oldPhotoToDiscard = session.draft_photo_path;
      }
    } else {
      reply = "Para preparar un anuncio envía una foto JPG, PNG o WEBP. Revisa antes que no aparezcan datos personales.";
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
