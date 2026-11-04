// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const getImagesButton = document.getElementById('getImagesButton');
const gallery = document.getElementById('gallery');

// The local apiKey.js file is ignored by Git so your key is not pushed.
const apiKey = window.NASA_API_KEY || 'DEMO_KEY';

const modal = document.createElement('div');
modal.className = 'modal hidden';
modal.setAttribute('role', 'dialog');
modal.setAttribute('aria-modal', 'true');

modal.innerHTML = `
	<div class="modal-backdrop" data-close="true"></div>
	<div class="modal-content">
		<button class="modal-close" type="button" aria-label="Close image details">×</button>
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
const modalCloseButton = modal.querySelector('.modal-close');

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

function openModal(image) {
	const imageUrl = image.hdurl || image.url || '';
	modalImage.src = imageUrl;
	modalImage.alt = image.title;
	modalTitle.textContent = image.title;
	modalDate.textContent = formatDisplayDate(image.date);
	modalExplanation.textContent = image.explanation;
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

modalCloseButton.addEventListener('click', closeModal);
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

	// Use the NASA Science endpoint from the assignment screenshots.
	const searchParams = new URLSearchParams({
		start_date: startInput.value,
		end_date: endInput.value,
		api_key: apiKey
	});
	const apiUrl = `https://science.nasa.gov/wp-json/wp/v2/apod-basic?${searchParams}`;

	gallery.textContent = 'Loading space images...';
	getImagesButton.disabled = true;

	try {
		const response = await fetch(apiUrl);
		const responseData = await response.json();

		if (!response.ok) {
			const apiError = responseData?.message || responseData?.error || responseData?.code;
			throw new Error(apiError || `NASA API request failed with status ${response.status}.`);
		}

		const images = Array.isArray(responseData) ? responseData : [responseData].filter(Boolean);

		if (!images.length) {
			throw new Error('NASA returned no images for the selected date range.');
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
			card.addEventListener('click', () => openModal(image));
			card.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					openModal(image);
				}
			});

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
				videoLink.href = image.url;
				videoLink.textContent = 'Watch this APOD video';
				videoLink.target = '_blank';
				videoLink.rel = 'noopener noreferrer';
				card.appendChild(videoLink);
			}

			gallery.appendChild(card);
		});
	} catch (error) {
		gallery.textContent = error.message;
	} finally {
		getImagesButton.disabled = false;
	}
}
