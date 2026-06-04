---
layout: archive
# title: "People"
permalink: /people/
author_profile: true
---

<link rel="stylesheet" href="{{ '/assets/css/people.css' | relative_url }}?v=14">

<div id="people-directory"></div>

<noscript>
	<p>The interactive directory requires JavaScript. Please enable it to view the team roster.</p>
</noscript>

<script>
	window.peopleData = {{ site.data.people | jsonify }};
	window.peopleBaseUrl = {{ '/people/' | relative_url | jsonify }};
</script>
<script src="{{ '/assets/js/people.js' | relative_url }}?v=14" defer></script>
