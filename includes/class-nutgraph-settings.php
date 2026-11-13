<?php
/**
 * Instellingen → Nutgraph: hier vul je de GitHub-repository in.
 *
 * @basis: instellingen
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Nutgraph_Settings {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register' ) );
		add_action( 'admin_post_nutgraph_check', array( __CLASS__, 'check_now' ) );
		add_action( 'update_option_nutgraph_github_repo', array( 'Nutgraph_Updater', 'clear_cache' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( NUTGRAPH_FILE ), array( __CLASS__, 'action_links' ) );
	}

	public static function menu() {
		add_options_page( 'Nutgraph', 'Nutgraph', 'manage_options', 'nutgraph-instellingen', array( __CLASS__, 'page' ) );
	}

	public static function register() {
		register_setting(
			'nutgraph',
			'nutgraph_github_repo',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);
	}

	public static function action_links( $links ) {
		$url = admin_url( 'options-general.php?page=nutgraph-instellingen' );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">Instellingen</a>' );
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
		wp_safe_redirect( admin_url( 'options-general.php?page=nutgraph-instellingen&checked=1' ) );
		exit;
	}

	public static function page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$repo    = Nutgraph_Updater::repo();
		$release = $repo ? Nutgraph_Updater::latest_release() : null;
		?>
		<div class="wrap">
			<h1>Nutgraph</h1>

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

			<h2>Het bord gebruiken</h2>
			<p>Zet de shortcode <code>[nutgraph]</code> op een pagina, of open het menu <a href="<?php echo esc_url( admin_url( 'admin.php?page=nutgraph' ) ); ?>">Nutgraph</a>.
			Borden worden in de browser van de gebruiker bewaard, niet op deze server.</p>
		</div>
		<?php
	}
}
