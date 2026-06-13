export function Lab() {
  return (
    <article className="prose lab">
      <div className="lab-note">
        <b>This page is the demo.</b> Every link here is a real navigation, and
        intently is running. Don't rush — drift toward a link the way you normally
        would, then click. Watch the badge in the bottom corner: pages you were
        clearly heading for arrive <em>prerendered</em>, with zero wait. The ones you
        jump to cold show their real load time. That gap is the whole point.
      </div>

      <h1>A field guide to instant navigation</h1>
      <p className="lab-meta">A worked example · click around</p>

      <p>
        Speed on the web is mostly about the moments you don't measure. A page that
        loads in 300ms feels fine in a benchmark and sluggish in the hand, because the
        300ms lands <em>after</em> the click, when attention is already moving. The
        trick isn't a faster server. It's starting sooner — during the half-second
        your cursor spends traveling to the link.
      </p>

      <p>
        That window is bigger than it sounds. From the moment you decide to click to
        the moment you actually do, a couple hundred milliseconds pass: the eyes find
        the target, the hand moves, the finger presses. If something starts loading
        the destination the instant your <em>intent</em> is clear, the page can be
        sitting there when you arrive. Try it now — wander up to the{" "}
        <a href="/docs">documentation</a> and notice it's already there.
      </p>

      <h2>Three ways to guess</h2>
      <p>
        There are a few honest signals for "this is the next click." The cheapest is
        the viewport: if a link is on screen, maybe load it. That's{" "}
        <a href="/docs#the-loader">broad and wasteful</a> — you fetch forty things to
        be ready for one. A sharper signal is the hover: wait until the cursor parks on
        a link. Precise, but late; by then the decision is old news.
      </p>
      <p>
        The signal intently leans on is <a href="/docs#how-it-works">trajectory</a> —
        where the cursor is actually heading. Aim is legible before arrival. Combine it
        with proximity and you can light up the one link a person is moving toward and
        leave the other thirty-nine alone. Head back to the{" "}
        <a href="/">home page</a> and watch the prediction demo do exactly this.
      </p>

      <h2>Guessing isn't enough — you have to load well</h2>
      <p>
        A prediction is only useful if you do something fast with it. Modern browsers
        give you two gears. A <a href="/docs#the-loader">prefetch</a> pulls the
        document's bytes into cache; the navigation still happens, but the download is
        already done. A <a href="/docs#the-loader">prerender</a> goes further — it
        builds the whole page in a hidden tab, runs its scripts, and keeps it warm, so
        the click is a swap, not a load.
      </p>
      <p>
        Prerender is the dramatic one, and the dangerous one. It <em>runs</em> the
        page. Aim it at a sign-out link or an add-to-cart button and you've fired the
        action just by looking at it. So it stays{" "}
        <a href="/docs#safety">behind a high confidence bar and a safety check</a>, and
        you keep side-effect links out of its reach.
      </p>

      <h2>Try the gap yourself</h2>
      <p>
        The <a href="/">race on the home page</a> makes the difference visible with a
        simulated slow server. But the realest test is this very site: hop between the{" "}
        <a href="/">home page</a>, these <a href="/lab">field notes</a>, and the{" "}
        <a href="/docs">docs</a>. Move naturally and most of those jumps will be
        instant — the badge will tell you which were prerendered. Jump somewhere you
        didn't telegraph and you'll see the cold number for contrast.
      </p>

      <h2>The whole thing</h2>
      <p>
        That's intently: predict from intent, tier by confidence, load with the best
        primitive the browser has. One call, ~4KB, and the pages show up before you do.
        When you're ready, the <a href="/docs#install">install is one line</a>.
      </p>

      <p className="lab-foot">
        ← <a href="/">back home</a> · <a href="/docs">read the docs</a>
      </p>
    </article>
  );
}
