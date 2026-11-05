// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const getImagesButton = document.getElementById('getImagesButton');
const gallery = document.getElementById('gallery');
const spaceFact = document.getElementById('spaceFact');

const spaceFacts = [
	'One day on Venus is longer than one year on Venus.',
	'Neutron stars can spin around 600 times per second.',
	'The footprints left by Apollo astronauts on the Moon can last for millions of years.',
	'Jupiter has the shortest day of all the planets in our Solar System, lasting about 10 hours.',
	'Sunlight takes about 8 minutes and 20 seconds to reach Earth.',
	'There are more stars in the observable universe than grains of sand on all of Earth\'s beaches.'
];

spaceFact.textContent = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];

// The local apiKey.js file is ignored by Git so your key is not pushed.
const apiKey = window.NASA_API_KEY || 'DEMO_KEY';

const modal = document.createElement('div');
modal.className = 'modal hidden';
modal.setAttribute('role', 'dialog');
modal.setAttribute('aria-modal', 'true');

modal.innerHTML = `
	<div class="modal-backdrop" data-close="true"></div>
	<div class="modal-content">
		<img class="modal-image" src="" alt="" />
		<div class="modal-body">
			<h2 class="modal-title"></h2>
			<p class="modal-date"></p>
			<p class="modal-explanation"></p>
		</div>
	</div>
`;

document.body.appendChild(modal);

const modalImage = modal.querySelector('.modal-image');
const modalTitle = modal.querySelector('.modal-title');
const modalDate = modal.querySelector('.modal-date');
const modalExplanation = modal.querySelector('.modal-explanation');

function formatDisplayDate(dateString) {
	if (!dateString) {
		return '';
	}

	const date = new Date(`${dateString}T00:00:00`);

	if (Number.isNaN(date.getTime())) {
		return dateString;
	}

	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}).format(date);
}

function getDatesInRange(startDateString, endDateString) {
	const dates = [];
	const currentDate = new Date(`${startDateString}T00:00:00Z`);
	const endDate = new Date(`${endDateString}T00:00:00Z`);

	while (currentDate <= endDate) {
		dates.push(currentDate.toISOString().split('T')[0]);
		currentDate.setUTCDate(currentDate.getUTCDate() + 1);
	}

	return dates;
}

function stripHtmlTags(value) {
	if (!value) {
		return '';
	}

	const tempElement = document.createElement('div');
	tempElement.innerHTML = value;
	return tempElement.textContent.replace(/\s+/g, ' ').trim();
}

function openModal(image) {
	const imageUrl = image.media_type === 'video'
		? image.hdurl || image.thumbnail_url || ''
		: image.hdurl || image.url || '';
	modalImage.src = imageUrl;
	modalImage.alt = image.title;
	modalTitle.textContent = image.title;
	modalDate.textContent = formatDisplayDate(image.date);
	modalExplanation.textContent = stripHtmlTags(image.explanation);
	modal.classList.remove('hidden');
}

function closeModal() {
	modal.classList.add('hidden');
	modalImage.src = '';
	modalImage.alt = '';
	modalTitle.textContent = '';
	modalDate.textContent = '';
	modalExplanation.textContent = '';
}

modal.addEventListener('click', (event) => {
	if (event.target.dataset.close === 'true') {
		closeModal();
	}
});

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
		closeModal();
	}
});

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

getImagesButton.addEventListener('click', getSpaceImages);

async function getSpaceImages() {
	if (!startInput.value || !endInput.value) {
		gallery.textContent = 'Please choose both a start date and an end date.';
		return;
	}

	if (startInput.value > endInput.value) {
		gallery.textContent = 'The start date must be before the end date.';
		return;
	}

	const expectedDates = getDatesInRange(startInput.value, endInput.value);
	if (expectedDates.length !== 9) {
		gallery.textContent = 'Please choose a date range that includes exactly 9 days.';
		return;
	}

	const searchParams = new URLSearchParams({
		start_date: startInput.value,
		end_date: endInput.value,
		per_page: '25',
		api_key: apiKey
	});
	const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';

	gallery.textContent = '🔄 Loading space images...';
	getImagesButton.disabled = true;

	try {
		const today = new Date(`${new Date().toISOString().split('T')[0]}T00:00:00Z`);
		const rangeEnd = new Date(`${endInput.value}T00:00:00Z`);
		const daysPerPage = 25;
		const millisecondsPerDay = 24 * 60 * 60 * 1000;
		// Start near the page where the selected end date should appear.
		let page = Math.floor((today.getTime() - rangeEnd.getTime()) / (daysPerPage * millisecondsPerDay)) + 1;
		let totalPages = Infinity;
		const pagesVisited = new Set();
		const imagesByDate = new Map();

		// The endpoint returns the archive in pages, so check adjacent pages as needed.
		while (imagesByDate.size < expectedDates.length && page >= 1 && page <= totalPages && !pagesVisited.has(page)) {
			pagesVisited.add(page);
			searchParams.set('page', String(page));

			const response = await fetch(`${apiUrl}?${searchParams}`);
			const responseData = await response.json();

			if (!response.ok) {
				const apiError = responseData?.message || responseData?.error || responseData?.code;
				throw new Error(apiError || `NASA API request failed with status ${response.status}.`);
			}

			if (!Array.isArray(responseData)) {
				throw new Error('NASA returned an unexpected response for the selected date range.');
			}

			const totalPagesHeader = response.headers.get('X-WP-TotalPages');
			if (totalPagesHeader) {
				totalPages = Number(totalPagesHeader);
			}

			const responseDates = responseData
				.map((image) => image.date)
				.filter(Boolean)
				.sort();

			responseData
				.filter((image) => expectedDates.includes(image.date))
				.forEach((image) => imagesByDate.set(image.date, image));

			if (imagesByDate.size === expectedDates.length || !responseDates.length) {
				break;
			}

			const missingDates = expectedDates.filter((date) => !imagesByDate.has(date));
			const oldestDate = responseDates[0];
			const newestDate = responseDates[responseDates.length - 1];

			if (missingDates.some((date) => date < oldestDate)) {
				page += 1;
			} else if (missingDates.some((date) => date > newestDate)) {
				page -= 1;
			} else {
				break;
			}
		}

		const images = expectedDates.map((date) => imagesByDate.get(date)).filter(Boolean);

		if (images.length !== expectedDates.length) {
			throw new Error(`NASA returned ${images.length} of 9 images for the selected date range.`);
		}

		console.log('NASA APOD response', {
			startDate: startInput.value,
			endDate: endInput.value,
			count: images.length
		});
		console.table(images.map(({ date, title, media_type, url }) => ({
			date,
			title,
			media_type,
			url
		})));

		gallery.replaceChildren();

		const hasOnlyPlaceholderImages = images.length > 0 && images.every((image) => {
			const imageUrl = image.hdurl || image.url || '';
			return image.title === 'NASA Science' && imageUrl.includes('nasa-logo');
		});

		if (hasOnlyPlaceholderImages) {
			gallery.textContent = 'NASA APOD returned placeholder data instead of the selected space images. Please try again later.';
			return;
		}

		images.forEach((image) => {
			const card = document.createElement('article');
			card.className = 'gallery-item';
			card.setAttribute('tabindex', '0');
			card.setAttribute('role', 'button');
			card.setAttribute('aria-label', `Open details for ${image.title}`);
			card.addEventListener('click', (event) => {
				if (!event.target.closest('a')) {
					openModal(image);
				}
			});
			card.addEventListener('keydown', (event) => {
				if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a')) {
					event.preventDefault();
					openModal(image);
				}
			});
			if (image.media_type !== 'image') {
				card.classList.add('gallery-item--video');
			}

			const title = document.createElement('h2');
			title.textContent = image.title;
			card.appendChild(title);

			const date = document.createElement('p');
			date.className = 'image-date';
			date.textContent = formatDisplayDate(image.date);
			card.appendChild(date);

			if (image.media_type === 'image') {
				const picture = document.createElement('img');
				picture.src = image.hdurl || image.url;
				picture.alt = image.title;
				card.appendChild(picture);
			} else {
				const videoLink = document.createElement('a');
				videoLink.className = 'video-link';
				videoLink.href = image.url;
				videoLink.textContent = 'Watch the NASA video';
				videoLink.target = '_blank';
				videoLink.rel = 'noopener noreferrer';
				card.appendChild(videoLink);

				const thumbnailUrl = image.thumbnail_url || image.hdurl;
				if (thumbnailUrl) {
					const thumbnail = document.createElement('img');
					thumbnail.className = 'video-thumbnail';
					thumbnail.src = thumbnailUrl;
					thumbnail.alt = `${image.title} video thumbnail`;
					thumbnail.loading = 'lazy';
					card.appendChild(thumbnail);
				}
			}

			gallery.appendChild(card);
		});
	} catch (error) {
		gallery.textContent = error.message;
	} finally {
		getImagesButton.disabled = false;
	}
}
