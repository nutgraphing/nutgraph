<?php
/**
 * Talen van het bord.
 *
 * Alle teksten van het bord staan hier, in het Nederlands en het Engels.
 * Beheerders kunnen onder Nutgraph-instellingen → Talen extra talen toevoegen;
 * die worden bewaard in de optie `nutgraph_languages` (alleen vertalingen,
 * nooit verhaalgegevens).
 *
 * Voeg je een tekst toe aan het bord? Zet hem dan hier in BEIDE talen.
 * In de teksten staan {n}, {name} enzovoort voor waarden die het bord invult.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Nutgraph_I18n {

	/** Talen die altijd aanwezig zijn. */
	const BUILTIN = array(
		'nl' => 'Nederlands',
		'en' => 'English',
	);

	/**
	 * Alle teksten: sleutel => array( 'nl' => ..., 'en' => ... ).
	 *
	 * @return array
	 */
	public static function strings() {
		return array(
			// Algemeen.
			'close'                 => array( 'nl' => 'Sluiten', 'en' => 'Close' ),
			'cancel'                => array( 'nl' => 'Annuleren', 'en' => 'Cancel' ),
			'save'                  => array( 'nl' => 'Opslaan', 'en' => 'Save' ),
			'create'                => array( 'nl' => 'Aanmaken', 'en' => 'Create' ),
			'add'                   => array( 'nl' => 'Toevoegen', 'en' => 'Add' ),
			'delete'                => array( 'nl' => 'Verwijderen', 'en' => 'Delete' ),
			'language'              => array( 'nl' => 'Taal', 'en' => 'Language' ),
			'noscript'              => array( 'nl' => 'Nutgraph werkt alleen met JavaScript.', 'en' => 'Nutgraph only works with JavaScript.' ),
			'saved'                 => array( 'nl' => 'Opgeslagen in deze browser', 'en' => 'Saved in this browser' ),
			'not_saved'             => array( 'nl' => 'Niet opgeslagen', 'en' => 'Not saved' ),
			'storage_full'          => array( 'nl' => 'Opslaan lukt niet: de opslag van deze browser is vol. Exporteer en verwijder oude verhalen.', 'en' => 'Saving failed: this browser\'s storage is full. Export and delete old stories.' ),

			// Kleuren.
			'color_yellow'          => array( 'nl' => 'Geel', 'en' => 'Yellow' ),
			'color_pink'            => array( 'nl' => 'Roze', 'en' => 'Pink' ),
			'color_green'           => array( 'nl' => 'Groen', 'en' => 'Green' ),
			'color_blue'            => array( 'nl' => 'Blauw', 'en' => 'Blue' ),
			'color_orange'          => array( 'nl' => 'Oranje', 'en' => 'Orange' ),
			'color_lilac'           => array( 'nl' => 'Lila', 'en' => 'Lilac' ),
			'color_white'           => array( 'nl' => 'Wit', 'en' => 'White' ),

			// Verhalen en bibliotheek.
			'new_story'             => array( 'nl' => 'Nieuw verhaal', 'en' => 'New story' ),
			'first_story'           => array( 'nl' => 'Mijn eerste verhaal', 'en' => 'My first story' ),
			'imported_story'        => array( 'nl' => 'Geïmporteerd verhaal', 'en' => 'Imported story' ),
			'library'               => array( 'nl' => 'Bibliotheek', 'en' => 'Library' ),
			'new_story_btn'         => array( 'nl' => '+ Nieuw verhaal', 'en' => '+ New story' ),
			'import'                => array( 'nl' => 'Importeren', 'en' => 'Import' ),
			'export'                => array( 'nl' => 'Exporteren', 'en' => 'Export' ),
			'export_all'            => array( 'nl' => 'Alles exporteren', 'en' => 'Export all' ),
			'library_empty'         => array( 'nl' => 'Je bibliotheek is leeg. Begin een nieuw verhaal of importeer een bestand.', 'en' => 'Your library is empty. Start a new story or import a file.' ),
			'library_hint'          => array( 'nl' => 'Je verhalen staan alleen in deze browser op dit apparaat. Exporteer regelmatig een reservekopie.', 'en' => 'Your stories are stored only in this browser on this device. Export a backup regularly.' ),
			'notes_one'             => array( 'nl' => '{n} briefje', 'en' => '{n} note' ),
			'notes_many'            => array( 'nl' => '{n} briefjes', 'en' => '{n} notes' ),
			'edited_on'             => array( 'nl' => 'bewerkt {date}', 'en' => 'edited {date}' ),
			'rename'                => array( 'nl' => 'Naam wijzigen', 'en' => 'Rename' ),
			'duplicate'             => array( 'nl' => 'Dupliceren', 'en' => 'Duplicate' ),
			'story_name'            => array( 'nl' => 'Naam van het verhaal', 'en' => 'Story name' ),
			'new_name'              => array( 'nl' => 'Nieuwe naam', 'en' => 'New name' ),
			'copy_suffix'           => array( 'nl' => '{name} (kopie)', 'en' => '{name} (copy)' ),
			'duplicated'            => array( 'nl' => 'Gedupliceerd: {name}', 'en' => 'Duplicated: {name}' ),
			'delete_story'          => array( 'nl' => 'Verhaal verwijderen', 'en' => 'Delete story' ),
			'delete_story_text'     => array( 'nl' => '"{name}" en alle briefjes en documenten erin verdwijnen uit deze browser. Dit kun je niet ongedaan maken.', 'en' => '"{name}" and all its notes and documents will be removed from this browser. This cannot be undone.' ),

			// Importeren.
			'not_nutgraph'          => array( 'nl' => 'Dit is geen Nutgraph-bestand.', 'en' => 'This is not a Nutgraph file.' ),
			'imported_one'          => array( 'nl' => 'Geïmporteerd: {name}', 'en' => 'Imported: {name}' ),
			'imported_many'         => array( 'nl' => '{n} verhalen geïmporteerd', 'en' => '{n} stories imported' ),
			'import_failed'         => array( 'nl' => 'Importeren mislukt.', 'en' => 'Import failed.' ),
			'file_unreadable'       => array( 'nl' => 'Het bestand is onleesbaar.', 'en' => 'The file cannot be read.' ),

			// Delen.
			'share_link'            => array( 'nl' => 'Deellink', 'en' => 'Share link' ),
			'share_title'           => array( 'nl' => 'Delen via link', 'en' => 'Share via link' ),
			'share_text'            => array( 'nl' => 'Wie deze link opent, krijgt een kopie van "{name}" in de eigen browser. De inhoud zit in de link zelf; er wordt niets op de server bewaard.', 'en' => 'Anyone who opens this link gets a copy of "{name}" in their own browser. The content is in the link itself; nothing is stored on the server.' ),
			'share_no_docs'         => array( 'nl' => 'Documenten gaan niet mee in een link. Gebruik Exporteren om ze mee te sturen.', 'en' => 'Documents are not included in a link. Use Export to send them along.' ),
			'share_long'            => array( 'nl' => 'Deze link is erg lang ({n} tekens). Sommige mail- en chatprogramma\'s knippen hem af. Stuur dan liever het exportbestand.', 'en' => 'This link is very long ({n} characters). Some email and chat apps cut it off. Send the export file instead.' ),
			'copy_link'             => array( 'nl' => 'Link kopiëren', 'en' => 'Copy link' ),
			'link_copied'           => array( 'nl' => 'Link gekopieerd', 'en' => 'Link copied' ),
			'share_received'        => array( 'nl' => 'Gedeeld verhaal ontvangen', 'en' => 'Shared story received' ),
			'share_received_text'   => array( 'nl' => '"{name}" met {n} briefjes. Wil je het toevoegen aan je bibliotheek? Het wordt alleen in deze browser opgeslagen.', 'en' => '"{name}" with {n} notes. Do you want to add it to your library? It will only be stored in this browser.' ),
			'dont_add'              => array( 'nl' => 'Niet toevoegen', 'en' => 'Don\'t add' ),
			'share_broken'          => array( 'nl' => 'Deze deellink is beschadigd of onvolledig.', 'en' => 'This share link is damaged or incomplete.' ),

			// Het bord.
			'add_note_btn'          => array( 'nl' => '+ Plakbriefje', 'en' => '+ Sticky note' ),
			'text_overview'         => array( 'nl' => 'Tekstoverzicht', 'en' => 'Text outline' ),
			'help'                  => array( 'nl' => 'Sleep briefjes naar een vak. Klik om te bewerken. Alt + pijltjestoetsen verplaatst het geselecteerde briefje. Rechtsklik op een briefje om er een briefje van de crazywall onder te hangen.', 'en' => 'Drag notes to a cell. Click to edit. Alt + arrow keys moves the selected note. Right-click a note to attach a note from the crazy wall underneath it.' ),
			'spine'                 => array( 'nl' => 'Ruggengraat', 'en' => 'Spine' ),
			'details'               => array( 'nl' => 'Details', 'en' => 'Details' ),
			'detail'                => array( 'nl' => 'Detail', 'en' => 'Detail' ),
			'untitled'              => array( 'nl' => 'Zonder titel', 'en' => 'Untitled' ),
			'row_n'                 => array( 'nl' => 'Rij {n}', 'en' => 'Row {n}' ),
			'insert_row_title'      => array( 'nl' => 'Lege rij hierboven invoegen', 'en' => 'Insert empty row above' ),
			'insert_row_label'      => array( 'nl' => 'Lege rij invoegen boven rij {n}', 'en' => 'Insert empty row above row {n}' ),
			'delete_row_title'      => array( 'nl' => 'Rij verwijderen', 'en' => 'Delete row' ),
			'delete_row_label'      => array( 'nl' => 'Rij {n} verwijderen', 'en' => 'Delete row {n}' ),
			'delete_row_text_one'   => array( 'nl' => 'Het briefje in deze rij verdwijnt. De rijen eronder schuiven op.', 'en' => 'The note in this row will be removed. The rows below move up.' ),
			'delete_row_text_many'  => array( 'nl' => 'De {n} briefjes in deze rij verdwijnen. De rijen eronder schuiven op.', 'en' => 'The {n} notes in this row will be removed. The rows below move up.' ),
			'add_note_spine_label'  => array( 'nl' => 'Plakbriefje toevoegen in rij {row}, ruggengraat', 'en' => 'Add sticky note in row {row}, spine' ),
			'add_note_detail_label' => array( 'nl' => 'Plakbriefje toevoegen in rij {row}, detailkolom {col}', 'en' => 'Add sticky note in row {row}, detail column {col}' ),
			'note_label_spine'      => array( 'nl' => '{title}, ruggengraat, rij {row}', 'en' => '{title}, spine, row {row}' ),
			'note_label_detail'     => array( 'nl' => '{title}, detail, rij {row}', 'en' => '{title}, detail, row {row}' ),
			'sources_one'           => array( 'nl' => '{n} bron', 'en' => '{n} source' ),
			'sources_many'          => array( 'nl' => '{n} bronnen', 'en' => '{n} sources' ),

			// Bewerkpaneel.
			'note'                  => array( 'nl' => 'Plakbriefje', 'en' => 'Sticky note' ),
			'edit_note_label'       => array( 'nl' => 'Plakbriefje bewerken', 'en' => 'Edit sticky note' ),
			'title'                 => array( 'nl' => 'Titel', 'en' => 'Title' ),
			'title_placeholder'     => array( 'nl' => 'Bijvoorbeeld: De opening', 'en' => 'For example: The opening' ),
			'color'                 => array( 'nl' => 'Kleur', 'en' => 'Colour' ),
			'custom_color'          => array( 'nl' => 'Eigen kleur', 'en' => 'Custom colour' ),
			'custom_color_label'    => array( 'nl' => 'Eigen kleur kiezen', 'en' => 'Choose a custom colour' ),
			'description'           => array( 'nl' => 'Beschrijving', 'en' => 'Description' ),
			'text_placeholder'      => array( 'nl' => 'Wat gebeurt hier? Citaten, feiten, vragen…', 'en' => 'What happens here? Quotes, facts, questions…' ),
			'sources'               => array( 'nl' => 'Bronnen', 'en' => 'Sources' ),
			'no_sources'            => array( 'nl' => 'Nog geen bronnen.', 'en' => 'No sources yet.' ),
			'link'                  => array( 'nl' => 'Link', 'en' => 'Link' ),
			'document'              => array( 'nl' => 'Document', 'en' => 'Document' ),
			'link_label_ph'         => array( 'nl' => 'Omschrijving (optioneel)', 'en' => 'Description (optional)' ),
			'link_label_aria'       => array( 'nl' => 'Omschrijving van de link', 'en' => 'Link description' ),
			'web_address'           => array( 'nl' => 'Webadres', 'en' => 'Web address' ),
			'invalid_url'           => array( 'nl' => 'Vul een geldig webadres in, beginnend met http of https.', 'en' => 'Enter a valid web address starting with http or https.' ),
			'add_link'              => array( 'nl' => 'Link toevoegen', 'en' => 'Add link' ),
			'add_document'          => array( 'nl' => 'Document toevoegen', 'en' => 'Add document' ),
			'file_too_big'          => array( 'nl' => '{name} is groter dan 25 MB. Voeg liever een link toe.', 'en' => '{name} is larger than 25 MB. Add a link instead.' ),
			'file_save_failed'      => array( 'nl' => 'Het document {name} kon niet worden opgeslagen.', 'en' => 'The document {name} could not be saved.' ),
			'docs_hint'             => array( 'nl' => 'Documenten blijven in deze browser. Ze gaan mee in een export, niet in een deellink.', 'en' => 'Documents stay in this browser. They are included in an export, not in a share link.' ),
			'remove_source'         => array( 'nl' => 'Bron verwijderen', 'en' => 'Remove source' ),
			'doc_missing_title'     => array( 'nl' => 'Dit document zat niet in de deellink of het exportbestand', 'en' => 'This document was not included in the share link or export file' ),
			'doc_unavailable'       => array( 'nl' => '{name} (document niet beschikbaar)', 'en' => '{name} (document not available)' ),
			'doc_gone'              => array( 'nl' => 'Dit document is niet meer aanwezig in deze browser.', 'en' => 'This document is no longer available in this browser.' ),
			'unnamed'               => array( 'nl' => 'naamloos', 'en' => 'unnamed' ),
			'pos_spine'             => array( 'nl' => 'Ruggengraat, rij {row}', 'en' => 'Spine, row {row}' ),
			'pos_detail'            => array( 'nl' => 'Detail, kolom {col}, rij {row}', 'en' => 'Detail, column {col}, row {row}' ),
			'delete_note'           => array( 'nl' => 'Briefje verwijderen', 'en' => 'Delete note' ),
			'delete_note_text'      => array( 'nl' => '"{name}" en de documenten erin verdwijnen.', 'en' => '"{name}" and its documents will be removed.' ),

			// Tekstoverzicht (Markdown).
			'md_source'             => array( 'nl' => 'Bron', 'en' => 'Source' ),
			'md_source_doc'         => array( 'nl' => 'Bron (document)', 'en' => 'Source (document)' ),

			// Tabbladen.
			'views'                 => array( 'nl' => 'Weergave', 'en' => 'View' ),
			'tab_storyboard'        => array( 'nl' => 'Storyboard', 'en' => 'Storyboard' ),
			'tab_wall'              => array( 'nl' => 'Crazywall', 'en' => 'Crazy wall' ),

			// Crazywall.
			'wall_help'             => array( 'nl' => 'Sleep de wand om te schuiven. Zoom met Ctrl + scrollwiel of met de knoppen rechtsonder. Dubbelklik op de wand voor een nieuw briefje. Sleep vanaf de punaise naar een ander briefje om een draad te spannen.', 'en' => 'Drag the wall to move around. Zoom with Ctrl + scroll wheel or the buttons at the bottom right. Double-click the wall for a new note. Drag from the pin to another note to stretch a thread.' ),
			'wall_empty'            => array( 'nl' => 'De wand is nog leeg. Dubbelklik ergens om een briefje te plakken, of gebruik + Plakbriefje.', 'en' => 'The wall is still empty. Double-click anywhere to stick a note, or use + Sticky note.' ),
			'zoom_in'               => array( 'nl' => 'Inzoomen', 'en' => 'Zoom in' ),
			'zoom_out'              => array( 'nl' => 'Uitzoomen', 'en' => 'Zoom out' ),
			'zoom_fit'              => array( 'nl' => 'Alles in beeld', 'en' => 'Fit all' ),
			'wall_item_label'       => array( 'nl' => '{title}, briefje op de crazywall', 'en' => '{title}, note on the crazy wall' ),
			'pin_hint'              => array( 'nl' => 'Sleep naar een ander briefje om een draad te spannen', 'en' => 'Drag to another note to stretch a thread' ),
			'wall_note'             => array( 'nl' => 'Briefje op de crazywall', 'en' => 'Note on the crazy wall' ),
			'wall_text_hint'        => array( 'nl' => 'Verwijs naar een bestand door de bestandsnaam op een eigen regel te typen, bijvoorbeeld interview-burgemeester.mp3. Uploaden kan hier niet.', 'en' => 'Refer to a file by typing its file name on a line of its own, for example interview-mayor.mp3. Uploading is not possible here.' ),
			'wall_files'            => array( 'nl' => 'Bestanden in dit briefje', 'en' => 'Files in this note' ),
			'wall_files_none'       => array( 'nl' => 'Geen bestandsnamen gevonden.', 'en' => 'No file names found.' ),
			'wires'                 => array( 'nl' => 'Draden', 'en' => 'Threads' ),
			'wires_none'            => array( 'nl' => 'Nog geen draden.', 'en' => 'No threads yet.' ),
			'wire_to'               => array( 'nl' => 'Draad spannen naar…', 'en' => 'Stretch a thread to…' ),
			'wire_add'              => array( 'nl' => 'Draad spannen', 'en' => 'Add thread' ),
			'wire_remove'           => array( 'nl' => 'Draad verwijderen', 'en' => 'Remove thread' ),
			'wire_label'            => array( 'nl' => 'Draad tussen {a} en {b}', 'en' => 'Thread between {a} and {b}' ),
			'wire_exists'           => array( 'nl' => 'Deze briefjes zijn al met elkaar verbonden.', 'en' => 'These notes are already connected.' ),
			'wire_color'            => array( 'nl' => 'Kleur van de draad: {name}', 'en' => 'Thread colour: {name}' ),
			'color_red'             => array( 'nl' => 'Rood', 'en' => 'Red' ),
			'color_black'           => array( 'nl' => 'Zwart', 'en' => 'Black' ),
			'used_one'              => array( 'nl' => 'Op storyboard', 'en' => 'On storyboard' ),
			'used_many'             => array( 'nl' => 'Op storyboard ({n}×)', 'en' => 'On storyboard ({n}×)' ),
			'on_storyboard'         => array( 'nl' => 'Op het storyboard', 'en' => 'On the storyboard' ),
			'on_storyboard_none'    => array( 'nl' => 'Dit briefje hangt nog onder geen enkel plakbriefje. Klik op het storyboard met de rechtermuisknop op een plakbriefje om het eronder te hangen.', 'en' => 'This note is not attached to any sticky note yet. On the storyboard, right-click a sticky note to attach it underneath.' ),
			'delete_wall_text'      => array( 'nl' => '"{name}" en de draden ervan verdwijnen van de wand.', 'en' => '"{name}" and its threads will be removed from the wall.' ),
			'delete_wall_used'      => array( 'nl' => '"{name}" en de draden ervan verdwijnen van de wand. Het verdwijnt ook onder de plakbriefjes op het storyboard waar het nu onder hangt ({n}).', 'en' => '"{name}" and its threads will be removed from the wall. It will also be removed from the sticky notes on the storyboard it is attached to ({n}).' ),

			// Onderliggende briefjes op het storyboard.
			'picker_title'          => array( 'nl' => 'Onderliggend briefje toevoegen', 'en' => 'Add underlying note' ),
			'picker_under'          => array( 'nl' => 'Onder: {name}', 'en' => 'Under: {name}' ),
			'picker_search'         => array( 'nl' => 'Zoek op de crazywall', 'en' => 'Search the crazy wall' ),
			'picker_none'           => array( 'nl' => 'Niets gevonden.', 'en' => 'Nothing found.' ),
			'picker_empty'          => array( 'nl' => 'De crazywall van dit verhaal is nog leeg.', 'en' => 'The crazy wall of this story is still empty.' ),
			'go_to_wall'            => array( 'nl' => 'Naar de crazywall', 'en' => 'Go to the crazy wall' ),
			'kids'                  => array( 'nl' => 'Onderliggende briefjes', 'en' => 'Underlying notes' ),
			'kids_none'             => array( 'nl' => 'Nog geen onderliggende briefjes. Klik met de rechtermuisknop op een plakbriefje, of gebruik de knop hieronder.', 'en' => 'No underlying notes yet. Right-click a sticky note, or use the button below.' ),
			'kids_add'              => array( 'nl' => '+ Van de crazywall', 'en' => '+ From the crazy wall' ),
			'kids_count_one'        => array( 'nl' => '{n} onderliggend briefje', 'en' => '{n} underlying note' ),
			'kids_count_many'       => array( 'nl' => '{n} onderliggende briefjes', 'en' => '{n} underlying notes' ),
			'kid_added'             => array( 'nl' => 'Toegevoegd onder "{name}"', 'en' => 'Added under "{name}"' ),
			'kid_removed'           => array( 'nl' => 'Losgemaakt van "{name}"', 'en' => 'Detached from "{name}"' ),
			'kid_remove'            => array( 'nl' => 'Losmaken', 'en' => 'Detach' ),
			'show_on_wall'          => array( 'nl' => 'Toon op crazywall', 'en' => 'Show on crazy wall' ),

			// Soorten briefjes op de crazywall (pictogrammen).
			'kind'                  => array( 'nl' => 'Soort', 'en' => 'Type' ),
			'kind_hint'             => array( 'nl' => 'Wat staat er op dit briefje? Het pictogram verschijnt op de wand.', 'en' => 'What is this note about? The icon appears on the wall.' ),
			'kind_none'             => array( 'nl' => 'Geen', 'en' => 'None' ),
			'kind_person'           => array( 'nl' => 'Persoon', 'en' => 'Person' ),
			'kind_organization'     => array( 'nl' => 'Organisatie of groep', 'en' => 'Organisation or group' ),
			'kind_place'            => array( 'nl' => 'Plek', 'en' => 'Place' ),
			'kind_event'            => array( 'nl' => 'Gebeurtenis', 'en' => 'Event' ),
			'kind_situation'        => array( 'nl' => 'Situatie of incident', 'en' => 'Situation or incident' ),
			'kind_time'             => array( 'nl' => 'Tijdstip of datum', 'en' => 'Time or date' ),
			'kind_object'           => array( 'nl' => 'Voorwerp', 'en' => 'Object' ),
			'kind_evidence'         => array( 'nl' => 'Spoor of bewijsstuk', 'en' => 'Clue or evidence' ),
			'kind_photo'            => array( 'nl' => 'Foto', 'en' => 'Photo' ),
			'kind_document'         => array( 'nl' => 'Document', 'en' => 'Document' ),
			'kind_money'            => array( 'nl' => 'Geld of transactie', 'en' => 'Money or transaction' ),
			'kind_vehicle'          => array( 'nl' => 'Voertuig', 'en' => 'Vehicle' ),
			'kind_phone'            => array( 'nl' => 'Telefoon of gesprek', 'en' => 'Phone call or conversation' ),
			'kind_message'          => array( 'nl' => 'Bericht of sociale media', 'en' => 'Message or social media' ),
			'kind_quote'            => array( 'nl' => 'Citaat of verklaring', 'en' => 'Quote or statement' ),
			'kind_source'           => array( 'nl' => 'Bron of tipgever', 'en' => 'Source or tipster' ),
			'kind_article'          => array( 'nl' => 'Nieuwsartikel', 'en' => 'News article' ),
			'kind_legal'            => array( 'nl' => 'Rechtszaak of regelgeving', 'en' => 'Court case or regulation' ),
			'kind_question'         => array( 'nl' => 'Open vraag', 'en' => 'Open question' ),
			'kind_idea'             => array( 'nl' => 'Idee of theorie', 'en' => 'Idea or theory' ),
			'kind_other'            => array( 'nl' => 'Iets anders', 'en' => 'Something else' ),

			// Bestandssoorten (pictogrammen op de crazywall).
			'ft_pdf'                => array( 'nl' => 'PDF-document', 'en' => 'PDF document' ),
			'ft_text'               => array( 'nl' => 'Tekstdocument', 'en' => 'Text document' ),
			'ft_sheet'              => array( 'nl' => 'Spreadsheet', 'en' => 'Spreadsheet' ),
			'ft_slides'             => array( 'nl' => 'Presentatie', 'en' => 'Presentation' ),
			'ft_image'              => array( 'nl' => 'Afbeelding', 'en' => 'Image' ),
			'ft_audio'              => array( 'nl' => 'Geluidsbestand', 'en' => 'Audio file' ),
			'ft_video'              => array( 'nl' => 'Video', 'en' => 'Video' ),
			'ft_archive'            => array( 'nl' => 'Gecomprimeerde map', 'en' => 'Compressed folder' ),
			'ft_mail'               => array( 'nl' => 'E-mail', 'en' => 'Email' ),
			'ft_web'                => array( 'nl' => 'Webpagina', 'en' => 'Web page' ),

			// Menu Meer: afdrukken en PDF.
			'more'                  => array( 'nl' => 'Meer', 'en' => 'More' ),
			'print'                 => array( 'nl' => 'Afdrukken', 'en' => 'Print' ),
			'export_pdf'            => array( 'nl' => 'Exporteren als PDF', 'en' => 'Export as PDF' ),
			'pdf_failed'            => array( 'nl' => 'De PDF kon niet worden gemaakt.', 'en' => 'The PDF could not be created.' ),
			'made_with'             => array( 'nl' => 'Gemaakt met Nutgraph · {date}', 'en' => 'Made with Nutgraph · {date}' ),
			'page_n'                => array( 'nl' => 'Pagina {n} van {total}', 'en' => 'Page {n} of {total}' ),
		);
	}

	/** Alleen de sleutels. */
	public static function keys() {
		return array_keys( self::strings() );
	}

	/**
	 * Talen die beheerders hebben toegevoegd: code => array( 'name' => ..., 'strings' => array ).
	 */
	public static function custom_languages() {
		$list = get_option( 'nutgraph_languages', array() );
		return is_array( $list ) ? $list : array();
	}

	/** Alle talen: code => naam. Ingebouwde talen eerst. */
	public static function languages() {
		$out = self::BUILTIN;
		foreach ( self::custom_languages() as $code => $lang ) {
			if ( ! isset( $out[ $code ] ) && ! empty( $lang['name'] ) ) {
				$out[ $code ] = $lang['name'];
			}
		}
		return $out;
	}

	/** De taal waarmee het bord opent als de gebruiker nog niets koos. */
	public static function default_language() {
		$code = get_option( 'nutgraph_default_language', 'nl' );
		return isset( self::languages()[ $code ] ) ? $code : 'nl';
	}

	/** Eén tekst in de standaardtaal (voor PHP, bijvoorbeeld de noscript-melding). */
	public static function text( $key ) {
		$code    = self::default_language();
		$strings = self::strings();
		if ( ! isset( $strings[ $key ] ) ) {
			return $key;
		}
		if ( isset( $strings[ $key ][ $code ] ) ) {
			return $strings[ $key ][ $code ];
		}
		$custom = self::custom_languages();
		if ( ! empty( $custom[ $code ]['strings'][ $key ] ) ) {
			return $custom[ $code ]['strings'][ $key ];
		}
		return $strings[ $key ]['en'];
	}

	/** Gegevens voor het bord in de browser. */
	public static function client_data() {
		$strings = array();
		foreach ( self::BUILTIN as $code => $name ) {
			$strings[ $code ] = array();
		}
		foreach ( self::strings() as $key => $texts ) {
			foreach ( self::BUILTIN as $code => $name ) {
				$strings[ $code ][ $key ] = $texts[ $code ];
			}
		}
		foreach ( self::custom_languages() as $code => $lang ) {
			if ( isset( self::BUILTIN[ $code ] ) ) {
				continue;
			}
			$strings[ $code ] = isset( $lang['strings'] ) && is_array( $lang['strings'] ) ? $lang['strings'] : array();
		}
		$languages = array();
		foreach ( self::languages() as $code => $name ) {
			$languages[] = array(
				'code' => $code,
				'name' => $name,
			);
		}
		return array(
			'languages' => $languages,
			'default'   => self::default_language(),
			'strings'   => $strings,
		);
	}

	/** Maakt een taalcode veilig: kleine letters, cijfers en streepjes, bijvoorbeeld "de" of "pt-br". */
	public static function clean_code( $code ) {
		$code = strtolower( trim( (string) $code ) );
		$code = str_replace( '_', '-', $code );
		return preg_match( '/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/', $code ) ? $code : '';
	}

	/**
	 * Controleert een volledige lijst met eigen talen.
	 *
	 * @param mixed $list Lijst zoals in de optie.
	 * @return array
	 */
	public static function clean_list( $list ) {
		$out = array();
		if ( ! is_array( $list ) ) {
			return $out;
		}
		$keys = self::keys();
		foreach ( $list as $code => $lang ) {
			$code = self::clean_code( $code );
			if ( ! $code || isset( self::BUILTIN[ $code ] ) || ! is_array( $lang ) ) {
				continue;
			}
			$name = isset( $lang['name'] ) ? sanitize_text_field( $lang['name'] ) : '';
			if ( '' === $name ) {
				continue;
			}
			$strings = array();
			foreach ( $keys as $key ) {
				if ( isset( $lang['strings'][ $key ] ) && is_string( $lang['strings'][ $key ] ) ) {
					$value = sanitize_text_field( $lang['strings'][ $key ] );
					if ( '' !== $value ) {
						$strings[ $key ] = $value;
					}
				}
			}
			$out[ $code ] = array(
				'name'    => $name,
				'strings' => $strings,
			);
		}
		return $out;
	}
}
