<?php
/**
 * Nutgraph-instellingen: een eigen menu-item in het hoofdmenu van wp-admin, met het Nutgraph-logo.
 * Hier vul je de GitHub-repository in en beheer je de talen van het bord.
 *
 * @basis: instellingen
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Nutgraph_Settings {

	const SLUG = 'nutgraph-instellingen';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register' ) );
		add_action( 'admin_init', array( __CLASS__, 'redirect_old_url' ) );
		add_action( 'admin_head', array( __CLASS__, 'menu_icon_style' ) );
		add_action( 'admin_post_nutgraph_check', array( __CLASS__, 'check_now' ) );
		add_action( 'update_option_nutgraph_github_repo', array( 'Nutgraph_Updater', 'clear_cache' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( NUTGRAPH_FILE ), array( __CLASS__, 'action_links' ) );
	}

	public static function url( $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => self::SLUG ), $args ), admin_url( 'admin.php' ) );
	}

	public static function menu() {
		add_menu_page(
			'Nutgraph-instellingen',
			'Nutgraph-instellingen',
			'manage_options',
			self::SLUG,
			array( __CLASS__, 'page' ),
			NUTGRAPH_URL . 'assets/nutgraph-logo.png',
			27
		);
	}

	/** Het logo is groter dan een menupictogram: op 20 pixels zetten en niet doorschijnend maken. */
	public static function menu_icon_style() {
		echo '<style>#adminmenu .toplevel_page_' . esc_attr( self::SLUG ) . ' .wp-menu-image img{width:20px;height:20px;padding:7px 0 0;opacity:1}</style>';
	}

	/** Oude links (Instellingen → Nutgraph) sturen we door naar de nieuwe plek. */
	public static function redirect_old_url() {
		global $pagenow;
		if ( 'options-general.php' === $pagenow && isset( $_GET['page'] ) && self::SLUG === $_GET['page'] ) { // phpcs:ignore WordPress.Security.NonceVerification
			wp_safe_redirect( self::url() );
			exit;
		}
	}

	public static function register() {
		// Elk formulier heeft een eigen groep, anders wist het ene formulier de waarden van het andere.
		register_setting(
			'nutgraph',
			'nutgraph_github_repo',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);
		register_setting(
			'nutgraph_taal',
			'nutgraph_default_language',
			array(
				'type'              => 'string',
				'sanitize_callback' => array( __CLASS__, 'sanitize_default_language' ),
				'default'           => 'nl',
			)
		);
		register_setting(
			'nutgraph_talen',
			'nutgraph_languages',
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize_languages' ),
				'default'           => array(),
			)
		);
	}

	public static function sanitize_default_language( $value ) {
		$value = Nutgraph_I18n::clean_code( $value );
		return isset( Nutgraph_I18n::languages()[ $value ] ) ? $value : 'nl';
	}

	/**
	 * Verwerkt het taalformulier. Het formulier stuurt één taal (opslaan of verwijderen);
	 * die voegen we samen met de talen die er al zijn.
	 *
	 * WordPress roept deze functie soms twee keer aan (de tweede keer met de complete lijst).
	 * Zonder '_action' is het dus al een complete lijst.
	 */
	public static function sanitize_languages( $input ) {
		$current = Nutgraph_I18n::custom_languages();
		if ( ! is_array( $input ) ) {
			return $current;
		}
		if ( ! isset( $input['_action'] ) ) {
			return Nutgraph_I18n::clean_list( $input );
		}

		$code = Nutgraph_I18n::clean_code( isset( $input['_code'] ) ? $input['_code'] : '' );

		if ( 'delete' === $input['_action'] ) {
			if ( $code && isset( $current[ $code ] ) ) {
				unset( $current[ $code ] );
				if ( get_option( 'nutgraph_default_language' ) === $code ) {
					// Nutgraph_I18n::default_language() valt dan vanzelf terug op Nederlands.
					add_settings_error( 'nutgraph_languages', 'nutgraph_default', 'Deze taal was de standaardtaal. Het bord opent nu weer in het Nederlands.', 'warning' );
				}
				add_settings_error( 'nutgraph_languages', 'nutgraph_deleted', 'De taal is verwijderd.', 'success' );
			}
			return $current;
		}

		if ( ! $code ) {
			add_settings_error( 'nutgraph_languages', 'nutgraph_code', 'De taalcode klopt niet. Gebruik twee of drie letters, bijvoorbeeld "de" of "fr", eventueel met een streepje en een regio, zoals "pt-br".' );
			return $current;
		}
		if ( isset( Nutgraph_I18n::BUILTIN[ $code ] ) ) {
			add_settings_error( 'nutgraph_languages', 'nutgraph_builtin', 'Nederlands en Engels zitten al in de plugin. Kies een andere taalcode.' );
			return $current;
		}
		$original = Nutgraph_I18n::clean_code( isset( $input['_original'] ) ? $input['_original'] : '' );
		if ( $original !== $code && isset( $current[ $code ] ) ) {
			add_settings_error( 'nutgraph_languages', 'nutgraph_exists', 'Er bestaat al een taal met de code "' . $code . '".' );
			return $current;
		}
		if ( $original && $original !== $code ) {
			unset( $current[ $original ] );
		}

		$current[ $code ] = array(
			'name'    => isset( $input['name'] ) ? $input['name'] : '',
			'strings' => isset( $input['strings'] ) && is_array( $input['strings'] ) ? $input['strings'] : array(),
		);
		$clean = Nutgraph_I18n::clean_list( $current );
		if ( ! isset( $clean[ $code ] ) ) {
			add_settings_error( 'nutgraph_languages', 'nutgraph_name', 'Vul een naam voor de taal in.' );
			return Nutgraph_I18n::clean_list( Nutgraph_I18n::custom_languages() );
		}
		add_settings_error( 'nutgraph_languages', 'nutgraph_saved', 'De taal "' . $clean[ $code ]['name'] . '" is opgeslagen.', 'success' );
		return $clean;
	}

	public static function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( self::url() ) . '">Instellingen</a>' );
		return $links;
	}

	/** Knop "Nu controleren": cache legen en WordPress opnieuw laten kijken. */
	public static function check_now() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_die( 'Je hebt geen rechten om updates te controleren.' );
		}
		check_admin_referer( 'nutgraph_check' );
		Nutgraph_Updater::clear_cache();
		delete_site_transient( 'update_plugins' );
		wp_update_plugins();
		wp_safe_redirect( self::url( array( 'checked' => 1 ) ) );
		exit;
	}

	public static function page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		// phpcs:disable WordPress.Security.NonceVerification -- alleen lezen welke taal je bewerkt.
		$edit = isset( $_GET['taal'] ) && ! isset( $_GET['settings-updated'] ) ? sanitize_text_field( wp_unslash( $_GET['taal'] ) ) : '';
		// phpcs:enable
		if ( '' !== $edit ) {
			self::language_form( $edit );
			return;
		}

		$repo    = Nutgraph_Updater::repo();
		$release = $repo ? Nutgraph_Updater::latest_release() : null;
		?>
		<div class="wrap">
			<h1 style="display:flex;align-items:center;gap:.5em">
				<img src="<?php echo esc_url( NUTGRAPH_URL . 'assets/nutgraph-logo.png' ); ?>" alt="" width="36" height="36">
				Nutgraph-instellingen
			</h1>

			<?php settings_errors(); ?>
			<?php if ( isset( $_GET['checked'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
				<div class="notice notice-success"><p>GitHub is opnieuw gecontroleerd.</p></div>
			<?php endif; ?>

			<h2>Updates via GitHub</h2>
			<form method="post" action="options.php">
				<?php settings_fields( 'nutgraph' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="nutgraph_github_repo">GitHub-repository</label></th>
						<td>
							<input name="nutgraph_github_repo" id="nutgraph_github_repo" type="text" class="regular-text"
								value="<?php echo esc_attr( get_option( 'nutgraph_github_repo', '' ) ); ?>"
								placeholder="gebruikersnaam/nutgraph">
							<p class="description">Bijvoorbeeld <code>janjansen/nutgraph</code>. Een volledige GitHub-link mag ook.</p>
						</td>
					</tr>
				</table>
				<?php submit_button( 'Repository opslaan' ); ?>
			</form>

			<h2>Status</h2>
			<table class="widefat striped" style="max-width:640px">
				<tbody>
					<tr><td>Geïnstalleerde versie</td><td><strong><?php echo esc_html( NUTGRAPH_VERSION ); ?></strong></td></tr>
					<tr><td>Nieuwste versie op GitHub</td><td>
						<?php
						if ( ! $repo ) {
							echo 'Nog geen repository ingevuld.';
						} elseif ( ! $release ) {
							echo 'Geen release gevonden. Controleer de naam en of er op GitHub een release bestaat.';
						} else {
							echo '<strong>' . esc_html( $release['version'] ) . '</strong> ';
							echo '<a href="' . esc_url( $release['url'] ) . '" target="_blank" rel="noopener">bekijk op GitHub</a>';
						}
						?>
					</td></tr>
				</tbody>
			</table>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:1em">
				<input type="hidden" name="action" value="nutgraph_check">
				<?php wp_nonce_field( 'nutgraph_check' ); ?>
				<?php submit_button( 'Nu controleren op updates', 'secondary', 'submit', false ); ?>
			</form>

			<?php self::languages_section(); ?>

			<h2>Het bord gebruiken</h2>
			<p>Zet de shortcode <code>[nutgraph]</code> op een pagina, of open het menu <a href="<?php echo esc_url( admin_url( 'admin.php?page=nutgraph' ) ); ?>">Nutgraph</a>.
			Borden worden in de browser van de gebruiker bewaard, niet op deze server.</p>
		</div>
		<?php
	}

	/** Overzicht van de talen en de keuze voor de standaardtaal. */
	private static function languages_section() {
		$languages = Nutgraph_I18n::languages();
		$custom    = Nutgraph_I18n::custom_languages();
		$total     = count( Nutgraph_I18n::keys() );
		?>
		<h2>Talen</h2>
		<p>Gebruikers kiezen de taal van het bord zelf, met de keuzelijst rechtsboven in het bord. Hun keuze wordt in hun eigen browser onthouden.</p>

		<form method="post" action="options.php">
			<?php settings_fields( 'nutgraph_taal' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="nutgraph_default_language">Standaardtaal van het bord</label></th>
					<td>
						<select name="nutgraph_default_language" id="nutgraph_default_language">
							<?php foreach ( $languages as $code => $name ) : ?>
								<option value="<?php echo esc_attr( $code ); ?>" <?php selected( Nutgraph_I18n::default_language(), $code ); ?>><?php echo esc_html( $name ); ?></option>
							<?php endforeach; ?>
						</select>
						<p class="description">In deze taal opent het bord voor iemand die nog geen taal heeft gekozen.</p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Standaardtaal opslaan', 'secondary' ); ?>
		</form>

		<table class="widefat striped" style="max-width:640px">
			<thead><tr><th>Taal</th><th>Code</th><th>Vertaald</th><th></th></tr></thead>
			<tbody>
				<?php foreach ( $languages as $code => $name ) : ?>
					<tr>
						<td><strong><?php echo esc_html( $name ); ?></strong></td>
						<td><code><?php echo esc_html( $code ); ?></code></td>
						<td>
							<?php
							if ( isset( Nutgraph_I18n::BUILTIN[ $code ] ) ) {
								echo 'Ingebouwd';
							} else {
								$done = isset( $custom[ $code ]['strings'] ) ? count( $custom[ $code ]['strings'] ) : 0;
								echo esc_html( $done . ' van ' . $total . ' teksten' );
							}
							?>
						</td>
						<td style="text-align:right">
							<?php if ( ! isset( Nutgraph_I18n::BUILTIN[ $code ] ) ) : ?>
								<a class="button button-small" href="<?php echo esc_url( self::url( array( 'taal' => $code ) ) ); ?>">Bewerken</a>
								<form method="post" action="options.php" style="display:inline" onsubmit="return confirm('Deze taal verwijderen? Gebruikers die deze taal gekozen hadden, zien het bord daarna in de standaardtaal.');">
									<?php settings_fields( 'nutgraph_talen' ); ?>
									<input type="hidden" name="nutgraph_languages[_action]" value="delete">
									<input type="hidden" name="nutgraph_languages[_code]" value="<?php echo esc_attr( $code ); ?>">
									<button type="submit" class="button button-small button-link-delete">Verwijderen</button>
								</form>
							<?php endif; ?>
						</td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
		<p><a class="button" href="<?php echo esc_url( self::url( array( 'taal' => 'nieuw' ) ) ); ?>">Taal toevoegen</a></p>
		<?php
	}

	/** Formulier om een taal toe te voegen of te bewerken. */
	private static function language_form( $edit ) {
		$custom   = Nutgraph_I18n::custom_languages();
		$is_new   = 'nieuw' === $edit || ! isset( $custom[ $edit ] );
		$code     = $is_new ? '' : $edit;
		$lang     = $is_new ? array( 'name' => '', 'strings' => array() ) : $custom[ $edit ];
		$strings  = Nutgraph_I18n::strings();
		?>
		<div class="wrap">
			<h1><?php echo $is_new ? 'Taal toevoegen' : esc_html( 'Taal bewerken: ' . $lang['name'] ); ?></h1>
			<p><a href="<?php echo esc_url( self::url() ); ?>">&larr; Terug naar Nutgraph-instellingen</a></p>
			<?php settings_errors(); ?>

			<form method="post" action="options.php">
				<?php settings_fields( 'nutgraph_talen' ); ?>
				<input type="hidden" name="nutgraph_languages[_action]" value="save">
				<input type="hidden" name="nutgraph_languages[_original]" value="<?php echo esc_attr( $code ); ?>">

				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="nutgraph_lang_name">Naam van de taal</label></th>
						<td>
							<input type="text" id="nutgraph_lang_name" name="nutgraph_languages[name]" class="regular-text" required
								value="<?php echo esc_attr( $lang['name'] ); ?>" placeholder="Deutsch">
							<p class="description">Zoals de taal in de keuzelijst van het bord moet staan. Schrijf hem het liefst in de taal zelf, bijvoorbeeld <em>Deutsch</em> of <em>Français</em>.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="nutgraph_lang_code">Taalcode</label></th>
						<td>
							<input type="text" id="nutgraph_lang_code" name="nutgraph_languages[_code]" class="small-text" required
								pattern="[A-Za-z]{2,3}([\-_][A-Za-z0-9]{2,8})?" style="width:8em"
								value="<?php echo esc_attr( $code ); ?>" placeholder="de">
							<p class="description">Twee of drie letters, bijvoorbeeld <code>de</code>, <code>fr</code> of <code>fy</code>. Een regio mag ook: <code>pt-br</code>. De code bepaalt ook hoe datums worden geschreven.</p>
						</td>
					</tr>
				</table>

				<h2>Vertalingen</h2>
				<p>Vul per tekst de vertaling in. Laat je een vak leeg, dan toont het bord de Engelse tekst.
				Woorden tussen accolades, zoals <code>{n}</code> of <code>{name}</code>, vult het bord zelf in: neem ze ongewijzigd over.</p>

				<table class="widefat striped">
					<thead><tr><th style="width:28%">Nederlands</th><th style="width:28%">English</th><th>Vertaling</th></tr></thead>
					<tbody>
						<?php foreach ( $strings as $key => $texts ) : ?>
							<tr>
								<td><label for="nutgraph_str_<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $texts['nl'] ); ?></label></td>
								<td><?php echo esc_html( $texts['en'] ); ?></td>
								<td>
									<input type="text" class="large-text" id="nutgraph_str_<?php echo esc_attr( $key ); ?>"
										name="nutgraph_languages[strings][<?php echo esc_attr( $key ); ?>]"
										value="<?php echo esc_attr( isset( $lang['strings'][ $key ] ) ? $lang['strings'][ $key ] : '' ); ?>">
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
				<?php submit_button( $is_new ? 'Taal toevoegen' : 'Taal opslaan' ); ?>
			</form>
		</div>
		<?php
	}
}
