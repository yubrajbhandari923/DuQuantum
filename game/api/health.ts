/** Simple production probe for the Vercel Functions runtime. */
export default {
  fetch() {
    return Response.json({ ok: true });
  },
};
