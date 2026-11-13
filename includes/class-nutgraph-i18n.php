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
			'help'                  => array( 'nl' => 'Sleep briefjes naar een vak. Klik om te bewerken. Alt + pijltjestoetsen verplaatst het geselecteerde briefje.', 'en' => 'Drag notes to a cell. Click to edit. Alt + arrow keys moves the selected note.' ),
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
